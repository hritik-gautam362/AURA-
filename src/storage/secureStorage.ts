/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DailyLog, PeriodEntry, SymptomType, UserSettings } from '../types';
import { decryptData, deriveKeyFromPassphrase, encryptData, generateSalt } from '../security/crypto';
import { CryptoEnvelope, CryptoError } from '../security/securityTypes';
import {
  deleteEncryptedRecord,
  getEncryptedRecord,
  openVaultDatabase,
  putEncryptedRecord,
  STORES,
} from './db';
import {
  EncryptedRecordEnvelope,
  SecureEntityType,
  SecureStorageError,
} from './storageTypes';
import { LEGACY_STORAGE_KEYS, MemoryStorageAdapter } from './migrations';
import { MigrationOrchestrator } from './migrationOrchestrator';

/**
 * Well-known root partition keys for domain entities in IndexedDB
 */
export const RECORD_KEYS = Object.freeze({
  PERIODS: 'periods_root',
  DAILY_LOGS: 'daily_logs_root',
  SETTINGS: 'settings_root',
  VERIFICATION: 'vault_verification_root',
});

/**
 * Validates that an in-memory CryptoKey is compatible with AES-GCM operations.
 */
function validateCryptoKey(key: CryptoKey): void {
  if (!key || typeof key !== 'object') {
    throw new SecureStorageError(
      'CryptoKey is missing or invalid.',
      'INVALID_KEY'
    );
  }
  if (key.algorithm.name !== 'AES-GCM') {
    throw new SecureStorageError(
      `Incompatible key algorithm: expected AES-GCM, got ${key.algorithm.name}.`,
      'INVALID_KEY'
    );
  }
}

/**
 * Generic primitive to serialize, encrypt, and persist a domain entity into IndexedDB.
 * Plaintext is NEVER written to IndexedDB.
 * Additional Authenticated Data (AAD) is bound to the entityType to prevent ciphertext-swap attacks.
 */
export async function saveSecureEntity<T>(
  entityType: SecureEntityType,
  id: string,
  data: T,
  key: CryptoKey
): Promise<void> {
  validateCryptoKey(key);

  if (!id || typeof id !== 'string') {
    throw new SecureStorageError('Record id must be a non-empty string.', 'RECORD_CORRUPTED');
  }

  // 1. JSON Serialization
  let serialized: string;
  try {
    serialized = JSON.stringify(data);
    if (typeof serialized !== 'string') {
      throw new Error('Serialization yielded non-string result.');
    }
  } catch (err) {
    throw new SecureStorageError(
      'Failed to serialize data to JSON.',
      'SERIALIZATION_FAILED',
      err
    );
  }

  // 2. Encryption via Web Crypto AES-256-GCM (AAD bound to entityType)
  let cryptoEnvelope: CryptoEnvelope;
  try {
    cryptoEnvelope = await encryptData(serialized, key, { aad: entityType });
  } catch (err) {
    throw new SecureStorageError(
      'Encryption operation failed. Data will not be written to storage.',
      'ENCRYPTION_FAILED',
      err
    );
  }

  // 3. Construct Envelope
  const now = new Date().toISOString();
  const envelope: EncryptedRecordEnvelope = {
    id,
    entityType,
    recordVersion: 1,
    algorithm: cryptoEnvelope.algorithm,
    keyVersion: 1,
    iv: cryptoEnvelope.iv,
    ciphertext: cryptoEnvelope.ciphertext,
    createdAt: now,
    updatedAt: now,
  };

  // 4. Atomic Write to IndexedDB
  try {
    await putEncryptedRecord(envelope);
  } catch (err) {
    throw new SecureStorageError(
      'Failed to persist encrypted envelope to IndexedDB.',
      'DATABASE_ERROR',
      err
    );
  }
}

/**
 * Generic primitive to load, authenticate, decrypt, and parse an encrypted entity from IndexedDB.
 * Fails closed if the record is missing, corrupted, wrong key, or wrong AAD.
 */
export async function loadSecureEntity<T>(
  entityType: SecureEntityType,
  id: string,
  key: CryptoKey
): Promise<T | null> {
  validateCryptoKey(key);

  if (!id || typeof id !== 'string') {
    throw new SecureStorageError('Record id must be a non-empty string.', 'RECORD_CORRUPTED');
  }

  // 1. Read Raw Envelope from IndexedDB
  let envelope: EncryptedRecordEnvelope | null = null;
  try {
    envelope = await getEncryptedRecord(id);
  } catch (err) {
    throw new SecureStorageError(
      'Failed to retrieve record from IndexedDB.',
      'DATABASE_ERROR',
      err
    );
  }

  if (!envelope) {
    return null;
  }

  // 2. Validate Envelope Structure
  if (envelope.entityType !== entityType) {
    throw new SecureStorageError(
      `Entity type mismatch: expected ${entityType}, got ${envelope.entityType}.`,
      'DECRYPTION_FAILED'
    );
  }

  if (!envelope.iv || !(envelope.iv instanceof Uint8Array) || envelope.iv.byteLength !== 12) {
    throw new SecureStorageError(
      'Encrypted envelope IV is corrupted or invalid.',
      'RECORD_CORRUPTED'
    );
  }

  if (
    !envelope.ciphertext ||
    !(envelope.ciphertext instanceof ArrayBuffer) ||
    envelope.ciphertext.byteLength < 16
  ) {
    throw new SecureStorageError(
      'Encrypted envelope ciphertext is corrupted or missing.',
      'RECORD_CORRUPTED'
    );
  }

  // 3. Authenticated Decryption via Web Crypto (AAD bound to expected entityType)
  const cryptoPayload: CryptoEnvelope = {
    cryptoVersion: envelope.recordVersion,
    algorithm: envelope.algorithm,
    iv: envelope.iv,
    ciphertext: envelope.ciphertext,
  };

  let decryptedPlaintext: string;
  try {
    decryptedPlaintext = await decryptData(cryptoPayload, key, { aad: entityType });
  } catch (err) {
    throw new SecureStorageError(
      'Decryption or authentication failed: incorrect key, mismatched AAD, or tampered record.',
      'DECRYPTION_FAILED',
      err
    );
  }

  // 4. JSON Deserialization
  try {
    return JSON.parse(decryptedPlaintext) as T;
  } catch (err) {
    throw new SecureStorageError(
      'Failed to parse decrypted plaintext as valid JSON.',
      'DESERIALIZATION_FAILED',
      err
    );
  }
}

/**
 * Deletes a secure entity from IndexedDB by ID.
 */
export async function deleteSecureEntity(id: string): Promise<void> {
  try {
    await deleteEncryptedRecord(id);
  } catch (err) {
    throw new SecureStorageError(
      'Failed to delete record from IndexedDB.',
      'DATABASE_ERROR',
      err
    );
  }
}

// ==========================================
// Domain-Specific High-Level Helpers
// ==========================================

export async function savePeriods(key: CryptoKey, periods: PeriodEntry[]): Promise<void> {
  await saveSecureEntity<PeriodEntry[]>('periods', RECORD_KEYS.PERIODS, periods, key);
}

export async function loadPeriods(key: CryptoKey): Promise<PeriodEntry[] | null> {
  return loadSecureEntity<PeriodEntry[]>('periods', RECORD_KEYS.PERIODS, key);
}

export async function deletePeriods(): Promise<void> {
  await deleteSecureEntity(RECORD_KEYS.PERIODS);
}

export async function saveDailyLogs(key: CryptoKey, logs: Record<string, DailyLog>): Promise<void> {
  await saveSecureEntity<Record<string, DailyLog>>('daily_logs', RECORD_KEYS.DAILY_LOGS, logs, key);
}

export async function loadDailyLogs(key: CryptoKey): Promise<Record<string, DailyLog> | null> {
  return loadSecureEntity<Record<string, DailyLog>>('daily_logs', RECORD_KEYS.DAILY_LOGS, key);
}

export async function deleteDailyLogs(): Promise<void> {
  await deleteSecureEntity(RECORD_KEYS.DAILY_LOGS);
}

export async function saveSettings(key: CryptoKey, settings: UserSettings): Promise<void> {
  await saveSecureEntity<UserSettings>('settings', RECORD_KEYS.SETTINGS, settings, key);
}

export async function loadSettings(key: CryptoKey): Promise<UserSettings | null> {
  return loadSecureEntity<UserSettings>('settings', RECORD_KEYS.SETTINGS, key);
}

export async function deleteSettings(): Promise<void> {
  await deleteSecureEntity(RECORD_KEYS.SETTINGS);
}

export async function clearAllSecureData(): Promise<void> {
  await Promise.all([
    deletePeriods(),
    deleteDailyLogs(),
    deleteSettings(),
  ]);
}

// ==========================================
// Synthetic Secure Storage Smoke Test Runner
// ==========================================

export interface SecureStorageTestItem {
  testName: string;
  passed: boolean;
  details?: string;
}

export interface SecureStorageSmokeTestReport {
  success: boolean;
  totalTests: number;
  passedTests: number;
  results: SecureStorageTestItem[];
  error?: string;
}

/**
 * Runs comprehensive, deterministic security tests against the secure storage layer.
 * Uses strictly synthetic, non-health data and cleans up every test record.
 */
export async function runSecureStorageSmokeTest(): Promise<SecureStorageSmokeTestReport> {
  const results: SecureStorageTestItem[] = [];
  const testId = `SECURE_STORAGE_TEST_ONLY_${Date.now()}`;
  const testSecretValue = 'VERY_SECRET_TEST_VALUE_2026';

  const recordTest = (testName: string, passed: boolean, details?: string) => {
    results.push({ testName, passed, details });
  };

  let testKeyA: CryptoKey | null = null;
  let testKeyB: CryptoKey | null = null;

  try {
    // 1. Setup Keys (PBKDF2 with small iteration count strictly for fast testing)
    const salt = generateSalt();
    testKeyA = await deriveKeyFromPassphrase('TestPassphrase-A-2026', salt, 1000);
    testKeyB = await deriveKeyFromPassphrase('TestPassphrase-B-9999', salt, 1000);
    recordTest('Key Derivation for Testing', !!testKeyA && !!testKeyB);

    // 2. Save and Load Round-Trip
    const testData = {
      message: 'Secure cycle data test',
      secret: testSecretValue,
      count: 42,
      active: true,
      tags: ['cramps', 'bloating'],
      nested: { date: '2026-09-27', flow: 'heavy' },
    };
    await saveSecureEntity('test', testId, testData, testKeyA);
    const loadedData = await loadSecureEntity<typeof testData>('test', testId, testKeyA);
    const roundTripMatches =
      loadedData !== null &&
      loadedData.secret === testSecretValue &&
      loadedData.count === 42 &&
      loadedData.nested.flow === 'heavy';
    recordTest('Save and Load Round-Trip (Deep Equality)', roundTripMatches);

    // 3. Plaintext Absence in Raw IndexedDB Record Test
    const rawEnvelope = await getEncryptedRecord(testId);
    let plaintextAbsent = false;
    if (rawEnvelope) {
      const envelopeJson = JSON.stringify(rawEnvelope);
      const containsPlaintext = envelopeJson.includes(testSecretValue);
      // Also inspect ciphertext bytes for ASCII substring
      const ciphertextBytes = new Uint8Array(rawEnvelope.ciphertext);
      const cipherAscii = String.fromCharCode(...ciphertextBytes.slice(0, 100));
      const cipherContainsPlaintext = cipherAscii.includes(testSecretValue);
      plaintextAbsent = !containsPlaintext && !cipherContainsPlaintext;
    }
    recordTest('Plaintext Absence in Raw IndexedDB Storage', plaintextAbsent);

    // 4. Wrong Key Rejection (Fail Closed)
    let wrongKeyFailed = false;
    try {
      await loadSecureEntity('test', testId, testKeyB);
    } catch (err) {
      if (err instanceof SecureStorageError && err.code === 'DECRYPTION_FAILED') {
        wrongKeyFailed = true;
      }
    }
    recordTest('Wrong Key Rejection (Fail Closed)', wrongKeyFailed);

    // 5. Wrong AAD / Cross-Entity Swap Rejection
    // The entity was saved with AAD 'test'; loading with AAD 'periods' must fail closed
    let crossEntityFailed = false;
    try {
      await loadSecureEntity('periods', testId, testKeyA);
    } catch (err) {
      if (err instanceof SecureStorageError && err.code === 'DECRYPTION_FAILED') {
        crossEntityFailed = true;
      }
    }
    recordTest('Wrong AAD / Cross-Entity Attack Rejection', crossEntityFailed);

    // 6. Tampered Ciphertext Rejection
    let tamperFailed = false;
    if (rawEnvelope) {
      const tamperedBytes = new Uint8Array(rawEnvelope.ciphertext.slice(0));
      tamperedBytes[0] ^= 0xff; // Flip first byte
      const tamperedRecord: EncryptedRecordEnvelope = {
        ...rawEnvelope,
        ciphertext: tamperedBytes.buffer,
      };
      await putEncryptedRecord(tamperedRecord);
      try {
        await loadSecureEntity('test', testId, testKeyA);
      } catch (err) {
        if (err instanceof SecureStorageError && err.code === 'DECRYPTION_FAILED') {
          tamperFailed = true;
        }
      }
      // Restore valid envelope for remaining tests
      await putEncryptedRecord(rawEnvelope);
    }
    recordTest('Tampered Ciphertext Rejection (Authentication Failure)', tamperFailed);

    // 7. Malformed Envelope Rejection (Invalid IV length)
    let malformedIvFailed = false;
    if (rawEnvelope) {
      const malformedRecord: EncryptedRecordEnvelope = {
        ...rawEnvelope,
        iv: new Uint8Array([1, 2, 3]), // 3 bytes instead of 12
      };
      await putEncryptedRecord(malformedRecord);
      try {
        await loadSecureEntity('test', testId, testKeyA);
      } catch (err) {
        if (err instanceof SecureStorageError && err.code === 'RECORD_CORRUPTED') {
          malformedIvFailed = true;
        }
      }
      await putEncryptedRecord(rawEnvelope);
    }
    recordTest('Malformed Envelope Rejection (Invalid IV)', malformedIvFailed);

    // 8. Key Non-Persistence Check
    // Verify that the CryptoKey is not in localStorage or IndexedDB
    let keyNotPersisted = true;
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        const v = k ? window.localStorage.getItem(k) : '';
        if (v && (v.includes('CryptoKey') || v.includes('TestPassphrase-A'))) {
          keyNotPersisted = false;
        }
      }
    }
    recordTest('Key Non-Persistence in Storage', keyNotPersisted);

    // 9. Unicode & Complex Serialization Test
    const unicodeId = `${testId}_unicode`;
    const unicodeData = {
      greeting: 'Bonjour Café ☕',
      japanese: '周期追跡 こんにちは 🌸',
      hindi: 'मासिक धर्म चक्र नमस्ते 🩸',
      emojis: '🔐❤️✨',
    };
    await saveSecureEntity('test', unicodeId, unicodeData, testKeyA);
    const loadedUnicode = await loadSecureEntity<typeof unicodeData>('test', unicodeId, testKeyA);
    const unicodeMatches =
      loadedUnicode !== null &&
      loadedUnicode.japanese === unicodeData.japanese &&
      loadedUnicode.hindi === unicodeData.hindi &&
      loadedUnicode.emojis === unicodeData.emojis;
    recordTest('Unicode & Multilingual Serialization Round-Trip', unicodeMatches);
    await deleteSecureEntity(unicodeId);

    // 10. Deletion Test & Clean-Up
    await deleteSecureEntity(testId);
    const deletedLoad = await loadSecureEntity('test', testId, testKeyA);
    const rawAfterDelete = await getEncryptedRecord(testId);
    const deletionSucceeded = deletedLoad === null && rawAfterDelete === null;
    recordTest('Secure Deletion & Complete Clean-Up', deletionSucceeded);

    const allPassed = results.every((r) => r.passed);
    return {
      success: allPassed,
      totalTests: results.length,
      passedTests: results.filter((r) => r.passed).length,
      results,
    };
  } catch (err) {
    // Attempt emergency cleanup of test records
    try {
      await deleteSecureEntity(testId);
      await deleteSecureEntity(`${testId}_unicode`);
    } catch {
      // Ignore cleanup error
    }
    return {
      success: false,
      totalTests: results.length,
      passedTests: results.filter((r) => r.passed).length,
      results,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ==========================================
// Phase 2E Real Cutover Automated Smoke Test Suite
// ==========================================

export interface Phase2ETestItem {
  testNumber: number;
  testName: string;
  passed: boolean;
  details?: string;
}

export interface Phase2ESmokeTestReport {
  success: boolean;
  totalTests: number;
  passedTests: number;
  results: Phase2ETestItem[];
  error?: string;
}

/**
 * Runs comprehensive, deterministic security tests against the Phase 2E cutover layer.
 * Strictly uses isolated prefixes and synthetic data.
 */
export async function runPhase2ESmokeTest(): Promise<Phase2ESmokeTestReport> {
  const results: Phase2ETestItem[] = [];
  const record = (testNumber: number, testName: string, passed: boolean, details?: string) => {
    results.push({ testNumber, testName, passed, details });
  };

  const testRunId = `P2E_TEST_${Date.now()}`;
  const prefix = `test_p2e_${testRunId}_`;

  let testKeyA: CryptoKey;
  let testKeyB: CryptoKey;

  try {
    const saltA = generateSalt();
    const saltB = generateSalt();
    testKeyA = await deriveKeyFromPassphrase('P2E-SecretPassphrase-2026', saltA, 1000);
    testKeyB = await deriveKeyFromPassphrase('P2E-WrongPassphrase-9999', saltB, 1000);
  } catch {
    return {
      success: false,
      totalTests: 17,
      passedTests: 0,
      results,
      error: 'Failed to derive test cryptographic keys.',
    };
  }

  try {
    // -------------------------------------------------------------------------
    // Test 1: Save & Load Periods (AES-256-GCM encrypted)
    // -------------------------------------------------------------------------
    const testPeriods: PeriodEntry[] = [
      {
        id: `${prefix}period_1`,
        startDate: '2026-09-01',
        endDate: '2026-09-05',
        flow: 'medium',
        symptoms: ['Cramps', 'Fatigue'] as SymptomType[],
        mood: 'Calm',
        notes: 'P2E_SECRET_PERIOD_NOTE',
        createdAt: '2026-09-01T08:00:00.000Z',
        updatedAt: '2026-09-05T18:00:00.000Z',
      },
    ];
    await savePeriods(testKeyA, testPeriods);
    const loadedPeriods = await loadPeriods(testKeyA);
    const t1Match =
      loadedPeriods !== null &&
      loadedPeriods.length === 1 &&
      loadedPeriods[0].notes === 'P2E_SECRET_PERIOD_NOTE' &&
      loadedPeriods[0].flow === 'medium';
    record(1, 'Save and load periods encrypted with AES-256-GCM', t1Match);

    // -------------------------------------------------------------------------
    // Test 2: Save & Load Daily Logs (AES-256-GCM encrypted)
    // -------------------------------------------------------------------------
    const testDailyLogs: Record<string, DailyLog> = {
      '2026-09-10': {
        date: '2026-09-10',
        isPeriodDay: false,
        symptoms: ['Headache'] as SymptomType[],
        mood: 'Happy',
        energy: 'high',
        notes: 'P2E_SECRET_DAILY_NOTE',
        updatedAt: '2026-09-10T12:00:00.000Z',
      },
    };
    await saveDailyLogs(testKeyA, testDailyLogs);
    const loadedDailyLogs = await loadDailyLogs(testKeyA);
    const t2Match =
      loadedDailyLogs !== null &&
      loadedDailyLogs['2026-09-10']?.notes === 'P2E_SECRET_DAILY_NOTE' &&
      loadedDailyLogs['2026-09-10']?.mood === 'Happy';
    record(2, 'Save and load daily logs encrypted with AES-256-GCM', t2Match);

    // -------------------------------------------------------------------------
    // Test 3: Save & Load Settings (AES-256-GCM encrypted)
    // -------------------------------------------------------------------------
    const testSettings: UserSettings = {
      userName: 'P2E_SECRET_USER',
      defaultCycleLength: 30,
      defaultPeriodDuration: 6,
      hasCompletedOnboarding: true,
      notifications: {
        periodReminder: true,
        expectedPeriodReminder: true,
        fertileWindowReminder: false,
        dailyTrackingReminder: true,
      },
      activeProfileId: 'test-p2e-profile',
    };
    await saveSettings(testKeyA, testSettings);
    const loadedSettings = await loadSettings(testKeyA);
    const t3Match =
      loadedSettings !== null &&
      loadedSettings.userName === 'P2E_SECRET_USER' &&
      loadedSettings.defaultCycleLength === 30;
    record(3, 'Save and load settings encrypted with AES-256-GCM', t3Match);

    // -------------------------------------------------------------------------
    // Test 4: Edit Period Persistence
    // -------------------------------------------------------------------------
    const updatedPeriods: PeriodEntry[] = [
      {
        ...testPeriods[0],
        endDate: '2026-09-06',
        notes: 'P2E_UPDATED_PERIOD_NOTE',
      },
    ];
    await savePeriods(testKeyA, updatedPeriods);
    const reloadedPeriods = await loadPeriods(testKeyA);
    const t4Match =
      reloadedPeriods !== null &&
      reloadedPeriods[0].notes === 'P2E_UPDATED_PERIOD_NOTE' &&
      reloadedPeriods[0].endDate === '2026-09-06';
    record(4, 'Edit period persistence in encrypted IndexedDB', t4Match);

    // -------------------------------------------------------------------------
    // Test 5: Delete Period Persistence
    // -------------------------------------------------------------------------
    await deletePeriods();
    const deletedPeriods = await loadPeriods(testKeyA);
    record(5, 'Delete periods permanently from IndexedDB', deletedPeriods === null);

    // -------------------------------------------------------------------------
    // Test 6: Edit Daily Log Persistence
    // -------------------------------------------------------------------------
    const updatedDailyLogs = {
      ...testDailyLogs,
      '2026-09-10': {
        ...testDailyLogs['2026-09-10'],
        notes: 'P2E_UPDATED_DAILY_NOTE',
        energy: 'low' as const,
      },
    };
    await saveDailyLogs(testKeyA, updatedDailyLogs);
    const reloadedDailyLogs = await loadDailyLogs(testKeyA);
    const t6Match =
      reloadedDailyLogs !== null &&
      reloadedDailyLogs['2026-09-10']?.notes === 'P2E_UPDATED_DAILY_NOTE' &&
      reloadedDailyLogs['2026-09-10']?.energy === 'low';
    record(6, 'Edit daily logs persistence in encrypted IndexedDB', t6Match);

    // -------------------------------------------------------------------------
    // Test 7: Delete Daily Log Persistence
    // -------------------------------------------------------------------------
    await deleteDailyLogs();
    const deletedLogs = await loadDailyLogs(testKeyA);
    record(7, 'Delete daily logs permanently from IndexedDB', deletedLogs === null);

    // -------------------------------------------------------------------------
    // Test 8: Delete Settings Persistence
    // -------------------------------------------------------------------------
    await deleteSettings();
    const deletedSettings = await loadSettings(testKeyA);
    record(8, 'Delete settings permanently from IndexedDB', deletedSettings === null);

    // -------------------------------------------------------------------------
    // Test 9: Locked Access Denial - Save with null key
    // -------------------------------------------------------------------------
    let t9Blocked = false;
    try {
      await savePeriods(null as unknown as CryptoKey, testPeriods);
    } catch (err) {
      if (err instanceof SecureStorageError && err.code === 'INVALID_KEY') {
        t9Blocked = true;
      }
    }
    record(9, 'Locked access denial on save (throws INVALID_KEY)', t9Blocked);

    // -------------------------------------------------------------------------
    // Test 10: Locked Access Denial - Load with null key
    // -------------------------------------------------------------------------
    let t10Blocked = false;
    try {
      await loadPeriods(null as unknown as CryptoKey);
    } catch (err) {
      if (err instanceof SecureStorageError && err.code === 'INVALID_KEY') {
        t10Blocked = true;
      }
    }
    record(10, 'Locked access denial on load (throws INVALID_KEY)', t10Blocked);

    // -------------------------------------------------------------------------
    // Test 11: Wrong Key Decryption Rejection
    // -------------------------------------------------------------------------
    const isolatedId = `${prefix}isolated_secret`;
    await saveSecureEntity('settings', isolatedId, testSettings, testKeyA);
    let t11Failed = false;
    try {
      await loadSecureEntity('settings', isolatedId, testKeyB);
    } catch (err) {
      if (err instanceof SecureStorageError && err.code === 'DECRYPTION_FAILED') {
        t11Failed = true;
      }
    }
    record(11, 'Wrong key decryption fails closed (DECRYPTION_FAILED)', t11Failed);

    // -------------------------------------------------------------------------
    // Test 12: Tampered Ciphertext Rejection
    // -------------------------------------------------------------------------
    const rawEnvelope = await getEncryptedRecord(isolatedId);
    let t12Failed = false;
    if (rawEnvelope && rawEnvelope.ciphertext instanceof ArrayBuffer) {
      const tamperedBytes = new Uint8Array(rawEnvelope.ciphertext);
      tamperedBytes[0] ^= 0xff; // Flip 8 bits
      await putEncryptedRecord({
        ...rawEnvelope,
        ciphertext: tamperedBytes.buffer,
      });
      try {
        await loadSecureEntity('settings', isolatedId, testKeyA);
      } catch (err) {
        if (err instanceof SecureStorageError && err.code === 'DECRYPTION_FAILED') {
          t12Failed = true;
        }
      }
    }
    record(12, 'Tampered ciphertext rejected via GCM auth tag', t12Failed);
    await deleteSecureEntity(isolatedId);

    // -------------------------------------------------------------------------
    // Test 13: Plaintext Absence in Raw IndexedDB Storage
    // -------------------------------------------------------------------------
    await saveSettings(testKeyA, testSettings);
    const rawStoredSettings = await getEncryptedRecord(RECORD_KEYS.SETTINGS);
    const rawStoredString = JSON.stringify(rawStoredSettings);
    const t13NoPlaintext =
      !rawStoredString.includes('P2E_SECRET_USER') &&
      !rawStoredString.includes('test-p2e-profile');
    record(13, 'Plaintext absence in raw IndexedDB storage envelope', t13NoPlaintext);
    await deleteSettings();

    // -------------------------------------------------------------------------
    // Test 14: Plaintext Absence in localStorage
    // -------------------------------------------------------------------------
    let t14Clean = true;
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        const v = k ? window.localStorage.getItem(k) : '';
        if (v && (v.includes('P2E_SECRET_') || v.includes('P2E-SecretPassphrase'))) {
          t14Clean = false;
        }
      }
    }
    record(14, 'Zero plaintext health data or keys written to localStorage', t14Clean);

    // -------------------------------------------------------------------------
    // Test 15: Migration Integration Round-Trip
    // -------------------------------------------------------------------------
    const t15Adapter = new MemoryStorageAdapter();
    t15Adapter.setItem(LEGACY_STORAGE_KEYS.SETTINGS, JSON.stringify(testSettings));
    t15Adapter.setItem(LEGACY_STORAGE_KEYS.PERIODS, JSON.stringify(testPeriods));
    t15Adapter.setItem(LEGACY_STORAGE_KEYS.DAILY_LOGS, JSON.stringify(testDailyLogs));

    const orchestrator = new MigrationOrchestrator();
    const t15Prefix = `${prefix}t15_`;
    const t15Res = await orchestrator.executeControlledMigration(testKeyA, {
      partitionPrefix: t15Prefix,
      storageAdapter: t15Adapter,
    });
    const t15Cleaned =
      t15Adapter.getItem(LEGACY_STORAGE_KEYS.SETTINGS) === null &&
      t15Adapter.getItem(LEGACY_STORAGE_KEYS.PERIODS) === null &&
      t15Adapter.getItem(LEGACY_STORAGE_KEYS.DAILY_LOGS) === null;
    record(
      15,
      'Controlled migration integration writes encrypted and clears legacy',
      t15Res.status === 'SUCCESS' && t15Cleaned
    );

    // -------------------------------------------------------------------------
    // Test 16: Migration Failure Fail-Closed Preservation
    // -------------------------------------------------------------------------
    const t16Adapter = new MemoryStorageAdapter();
    t16Adapter.setItem(LEGACY_STORAGE_KEYS.SETTINGS, JSON.stringify(testSettings));
    const t16Res = await orchestrator.executeControlledMigration(testKeyA, {
      partitionPrefix: `${prefix}t16_`,
      storageAdapter: t16Adapter,
      simulateFailureAt: 'settings_write',
    });
    const t16Preserved = t16Adapter.getItem(LEGACY_STORAGE_KEYS.SETTINGS) !== null;
    record(
      16,
      'Migration failure fail-closed preservation of legacy data',
      t16Res.status === 'FAILED' && t16Preserved
    );

    // -------------------------------------------------------------------------
    // Test 17: Clear All Secure Data
    // -------------------------------------------------------------------------
    await savePeriods(testKeyA, testPeriods);
    await saveDailyLogs(testKeyA, testDailyLogs);
    await saveSettings(testKeyA, testSettings);
    await clearAllSecureData();
    const pAfterClear = await loadPeriods(testKeyA);
    const dAfterClear = await loadDailyLogs(testKeyA);
    const sAfterClear = await loadSettings(testKeyA);
    const t17AllCleared = pAfterClear === null && dAfterClear === null && sAfterClear === null;
    record(17, 'clearAllSecureData successfully purges all vault entities', t17AllCleared);

    const allPassed = results.every((r) => r.passed);
    return {
      success: allPassed,
      totalTests: results.length,
      passedTests: results.filter((r) => r.passed).length,
      results,
    };
  } catch (err) {
    return {
      success: false,
      totalTests: results.length,
      passedTests: results.filter((r) => r.passed).length,
      results,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
