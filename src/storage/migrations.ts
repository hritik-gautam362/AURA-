/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DailyLog,
  EnergyLevel,
  FlowLevel,
  MoodType,
  PeriodEntry,
  SymptomType,
  UserSettings,
} from '../types';
import { deriveKeyFromPassphrase, generateSalt } from '../security/crypto';
import {
  deleteAppState,
  getAppState,
  getEncryptedRecord,
  putAppState,
  putEncryptedRecord,
} from './db';
import {
  deleteSecureEntity,
  loadSecureEntity,
  RECORD_KEYS,
  saveSecureEntity,
} from './secureStorage';
import { EncryptedRecordEnvelope, SecureStorageError } from './storageTypes';

/**
 * Real legacy localStorage keys discovered in `src/utils/storage.ts`
 */
export const LEGACY_STORAGE_KEYS = Object.freeze({
  SETTINGS: 'aura_cycle_user_settings_v1',
  PERIODS: 'aura_cycle_periods_v1',
  DAILY_LOGS: 'aura_cycle_daily_logs_v1',
});

/**
 * Migration version & state storage keys
 */
export const CURRENT_MIGRATION_VERSION = 1;
export const MIGRATION_STATE_KEY = 'migration_state_v1';

/**
 * Strongly typed migration status codes
 */
export type MigrationStatusCode =
  | 'SUCCESS'
  | 'FAILED'
  | 'NOT_READY'
  | 'ALREADY_COMPLETED'
  | 'NO_MIGRATION_REQUIRED';

/**
 * Safe diagnostic reason codes (zero health or key data)
 */
export type MigrationFailureReason =
  | 'NO_KEY_PROVIDED'
  | 'INVALID_KEY'
  | 'DATABASE_ERROR'
  | 'VALIDATION_FAILED'
  | 'ENCRYPTION_FAILED'
  | 'DECRYPTION_FAILED'
  | 'VERIFICATION_MISMATCH'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'CLEANUP_GUARD_REJECTED'
  | 'CORRUPTED_EXISTING_RECORD'
  | 'UNKNOWN_ERROR';

/**
 * Diagnostic summary of migrated datasets
 */
export interface MigrationSummary {
  settingsMigrated: boolean;
  periodsCount: number;
  dailyLogsCount: number;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
}

/**
 * Strongly typed migration result
 */
export interface MigrationResult {
  status: MigrationStatusCode;
  reason?: MigrationFailureReason;
  message: string;
  summary?: MigrationSummary;
}

/**
 * Versioned migration state persisted in IndexedDB `appState` store
 */
export interface MigrationStateRecord {
  version: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  failureReason?: MigrationFailureReason;
  verifiedDatasets: {
    settings: boolean;
    periods: boolean;
    dailyLogs: boolean;
  };
}

/**
 * Storage adapter abstraction for legacy storage reading.
 * Allows safe dependency injection in synthetic smoke tests so real localStorage is never touched.
 */
export interface LegacyStorageAdapter {
  getItem(key: string): string | null;
  setItem?(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Default adapter reading the real browser localStorage.
 * Used exclusively when invoked against real application storage in future phases.
 */
function getDefaultStorageAdapter(): LegacyStorageAdapter {
  return {
    getItem: (key: string) => {
      try {
        return typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem(key)
          : null;
      } catch {
        return null;
      }
    },
    removeItem: (key: string) => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Safe fail-closed
      }
    },
  };
}

/**
 * Options for migration execution
 */
export interface MigrationOptions {
  partitionPrefix?: string;
  storageAdapter?: LegacyStorageAdapter;
  simulateFailureAt?:
    | 'validation'
    | 'settings_write'
    | 'periods_write'
    | 'daily_logs_write'
    | 'verification'
    | 'app_state';
}

/**
 * Cleanup options and results
 */
export interface CleanupOptions {
  partitionPrefix?: string;
  storageAdapter?: LegacyStorageAdapter;
}

export interface CleanupResult {
  success: boolean;
  reason?: MigrationFailureReason;
  message: string;
  keysRemoved: string[];
}

/**
 * Strongly typed validation error for legacy dataset parsing
 */
export class MigrationValidationError extends Error {
  readonly code: MigrationFailureReason = 'VALIDATION_FAILED';
  readonly dataset: 'settings' | 'periods' | 'daily_logs';

  constructor(dataset: 'settings' | 'periods' | 'daily_logs', message: string) {
    super(message);
    this.name = 'MigrationValidationError';
    this.dataset = dataset;
  }
}

// ==========================================
// Strict Domain Validation Helpers
// ==========================================

const VALID_FLOW_LEVELS: ReadonlySet<string> = new Set(['light', 'medium', 'heavy']);
const VALID_ENERGY_LEVELS: ReadonlySet<string> = new Set(['low', 'normal', 'high']);
const VALID_MOOD_TYPES: ReadonlySet<string> = new Set([
  'Happy',
  'Calm',
  'Irritated',
  'Sad',
  'Anxious',
  'Tired',
  'Energetic',
]);

/**
 * Validates calendar date string format (YYYY-MM-DD) and mathematical date correctness.
 */
export function isValidDateString(str: unknown): boolean {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }
  const [yearStr, monthStr, dayStr] = str.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Validates legacy UserSettings structure and types.
 */
export function validateSettings(data: unknown): UserSettings {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new MigrationValidationError('settings', 'Settings must be a non-null object.');
  }

  const s = data as Record<string, unknown>;

  if (typeof s.userName !== 'string' || s.userName.trim().length === 0) {
    throw new MigrationValidationError('settings', 'Invalid or missing userName.');
  }

  if (
    typeof s.defaultCycleLength !== 'number' ||
    !Number.isInteger(s.defaultCycleLength) ||
    s.defaultCycleLength < 10 ||
    s.defaultCycleLength > 100
  ) {
    throw new MigrationValidationError('settings', 'Invalid defaultCycleLength.');
  }

  if (
    typeof s.defaultPeriodDuration !== 'number' ||
    !Number.isInteger(s.defaultPeriodDuration) ||
    s.defaultPeriodDuration < 1 ||
    s.defaultPeriodDuration > 30
  ) {
    throw new MigrationValidationError('settings', 'Invalid defaultPeriodDuration.');
  }

  if (typeof s.hasCompletedOnboarding !== 'boolean') {
    throw new MigrationValidationError('settings', 'Invalid hasCompletedOnboarding flag.');
  }

  if (typeof s.activeProfileId !== 'string' || s.activeProfileId.length === 0) {
    throw new MigrationValidationError('settings', 'Invalid activeProfileId.');
  }

  if (!s.notifications || typeof s.notifications !== 'object' || Array.isArray(s.notifications)) {
    throw new MigrationValidationError('settings', 'Invalid notifications object.');
  }

  const n = s.notifications as Record<string, unknown>;
  if (
    typeof n.periodReminder !== 'boolean' ||
    typeof n.expectedPeriodReminder !== 'boolean' ||
    typeof n.fertileWindowReminder !== 'boolean' ||
    typeof n.dailyTrackingReminder !== 'boolean'
  ) {
    throw new MigrationValidationError('settings', 'Invalid notification flags.');
  }

  return {
    userName: s.userName,
    defaultCycleLength: s.defaultCycleLength,
    defaultPeriodDuration: s.defaultPeriodDuration,
    hasCompletedOnboarding: s.hasCompletedOnboarding,
    notifications: {
      periodReminder: n.periodReminder,
      expectedPeriodReminder: n.expectedPeriodReminder,
      fertileWindowReminder: n.fertileWindowReminder,
      dailyTrackingReminder: n.dailyTrackingReminder,
    },
    activeProfileId: s.activeProfileId,
  };
}

/**
 * Validates legacy PeriodEntry array.
 */
export function validatePeriods(data: unknown): PeriodEntry[] {
  if (!Array.isArray(data)) {
    throw new MigrationValidationError('periods', 'Periods must be an array.');
  }

  return data.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new MigrationValidationError('periods', `Period entry at index ${index} is not an object.`);
    }

    const p = entry as Record<string, unknown>;

    if (typeof p.id !== 'string' || p.id.trim().length === 0) {
      throw new MigrationValidationError('periods', `Period entry at index ${index} has missing or empty id.`);
    }

    if (!isValidDateString(p.startDate)) {
      throw new MigrationValidationError('periods', `Period entry ${p.id} has invalid startDate.`);
    }

    if (p.endDate !== null && !isValidDateString(p.endDate)) {
      throw new MigrationValidationError('periods', `Period entry ${p.id} has invalid endDate.`);
    }

    if (typeof p.flow !== 'string' || !VALID_FLOW_LEVELS.has(p.flow)) {
      throw new MigrationValidationError('periods', `Period entry ${p.id} has invalid flow level.`);
    }

    if (!Array.isArray(p.symptoms)) {
      throw new MigrationValidationError('periods', `Period entry ${p.id} symptoms must be an array.`);
    }

    for (const sym of p.symptoms) {
      if (typeof sym !== 'string') {
        throw new MigrationValidationError('periods', `Period entry ${p.id} contains invalid symptom.`);
      }
    }

    if (typeof p.createdAt !== 'string' || p.createdAt.length === 0) {
      throw new MigrationValidationError('periods', `Period entry ${p.id} has missing createdAt.`);
    }

    if (typeof p.updatedAt !== 'string' || p.updatedAt.length === 0) {
      throw new MigrationValidationError('periods', `Period entry ${p.id} has missing updatedAt.`);
    }

    if (p.mood !== undefined && (typeof p.mood !== 'string' || !VALID_MOOD_TYPES.has(p.mood))) {
      throw new MigrationValidationError('periods', `Period entry ${p.id} has invalid mood.`);
    }

    if (p.notes !== undefined && typeof p.notes !== 'string') {
      throw new MigrationValidationError('periods', `Period entry ${p.id} has invalid notes.`);
    }

    return {
      id: p.id,
      startDate: p.startDate as string,
      endDate: (p.endDate as string) ?? null,
      flow: p.flow as FlowLevel,
      symptoms: p.symptoms as SymptomType[],
      mood: p.mood as MoodType | undefined,
      notes: p.notes as string | undefined,
      createdAt: p.createdAt as string,
      updatedAt: p.updatedAt as string,
    };
  });
}

/**
 * Validates legacy DailyLog map (Record<string, DailyLog>).
 */
export function validateDailyLogs(data: unknown): Record<string, DailyLog> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new MigrationValidationError('daily_logs', 'Daily logs must be a non-null object.');
  }

  const result: Record<string, DailyLog> = {};
  const entries = Object.entries(data as Record<string, unknown>);

  for (const [key, value] of entries) {
    if (!isValidDateString(key)) {
      throw new MigrationValidationError('daily_logs', `Daily log key "${key}" is not a valid date.`);
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new MigrationValidationError('daily_logs', `Daily log entry for "${key}" is not an object.`);
    }

    const log = value as Record<string, unknown>;

    if (log.date !== key) {
      throw new MigrationValidationError('daily_logs', `Daily log entry date does not match key "${key}".`);
    }

    if (typeof log.isPeriodDay !== 'boolean') {
      throw new MigrationValidationError('daily_logs', `Daily log entry "${key}" has invalid isPeriodDay.`);
    }

    if (!Array.isArray(log.symptoms)) {
      throw new MigrationValidationError('daily_logs', `Daily log entry "${key}" symptoms must be an array.`);
    }

    for (const sym of log.symptoms) {
      if (typeof sym !== 'string') {
        throw new MigrationValidationError('daily_logs', `Daily log entry "${key}" contains invalid symptom.`);
      }
    }

    if (typeof log.updatedAt !== 'string' || log.updatedAt.length === 0) {
      throw new MigrationValidationError('daily_logs', `Daily log entry "${key}" has missing updatedAt.`);
    }

    if (log.flow !== undefined && (typeof log.flow !== 'string' || !VALID_FLOW_LEVELS.has(log.flow))) {
      throw new MigrationValidationError('daily_logs', `Daily log entry "${key}" has invalid flow.`);
    }

    if (log.mood !== undefined && (typeof log.mood !== 'string' || !VALID_MOOD_TYPES.has(log.mood))) {
      throw new MigrationValidationError('daily_logs', `Daily log entry "${key}" has invalid mood.`);
    }

    if (log.energy !== undefined && (typeof log.energy !== 'string' || !VALID_ENERGY_LEVELS.has(log.energy))) {
      throw new MigrationValidationError('daily_logs', `Daily log entry "${key}" has invalid energy.`);
    }

    if (log.notes !== undefined && typeof log.notes !== 'string') {
      throw new MigrationValidationError('daily_logs', `Daily log entry "${key}" has invalid notes.`);
    }

    result[key] = {
      date: log.date as string,
      isPeriodDay: log.isPeriodDay as boolean,
      flow: log.flow as FlowLevel | undefined,
      symptoms: log.symptoms as SymptomType[],
      mood: log.mood as MoodType | undefined,
      energy: log.energy as EnergyLevel | undefined,
      notes: log.notes as string | undefined,
      updatedAt: log.updatedAt as string,
    };
  }

  return result;
}

/**
 * Deep semantic equality comparison.
 * Detects missing, extra, or modified fields, numbers, strings, arrays, objects.
 * Ignores undefined properties to match JSON serialization semantics.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object') {
    if (Array.isArray(b)) return false;
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;

    const aKeys = Object.keys(aObj).filter((k) => aObj[k] !== undefined);
    const bKeys = Object.keys(bObj).filter((k) => bObj[k] !== undefined);

    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }

  return false;
}

/**
 * Detects whether legacy data exists in the provided storage adapter (or window.localStorage).
 * Only checks for key existence with non-empty string content.
 * Never logs or prints sensitive health data.
 */
export function hasLegacyData(adapter?: LegacyStorageAdapter): boolean {
  const target = adapter ?? getDefaultStorageAdapter();
  try {
    const s = target.getItem(LEGACY_STORAGE_KEYS.SETTINGS);
    const p = target.getItem(LEGACY_STORAGE_KEYS.PERIODS);
    const d = target.getItem(LEGACY_STORAGE_KEYS.DAILY_LOGS);

    const hasSettings = s !== null && s.trim().length > 0;
    const hasPeriods = p !== null && p.trim().length > 0;
    const hasDailyLogs = d !== null && d.trim().length > 0;

    return hasSettings || hasPeriods || hasDailyLogs;
  } catch {
    return false;
  }
}

// ==========================================
// Migration Engine Orchestration
// ==========================================

/**
 * Migrates legacy localStorage datasets into the encrypted IndexedDB vault.
 * Requires an in-memory CryptoKey.
 * Completely idempotent: safe to call repeatedly.
 * Fails closed on any corruption or validation error without deleting source data.
 */
export async function migrateLegacyData(
  key: CryptoKey | null | undefined,
  options?: MigrationOptions
): Promise<MigrationResult> {
  const startedAt = new Date().toISOString();
  const prefix = options?.partitionPrefix ?? '';
  const stateKey = `${prefix}${MIGRATION_STATE_KEY}`;
  const settingsId = `${prefix}${RECORD_KEYS.SETTINGS}`;
  const periodsId = `${prefix}${RECORD_KEYS.PERIODS}`;
  const dailyLogsId = `${prefix}${RECORD_KEYS.DAILY_LOGS}`;
  const adapter = options?.storageAdapter ?? getDefaultStorageAdapter();

  // 1. Require In-Memory CryptoKey
  if (!key || typeof key !== 'object' || key.algorithm?.name !== 'AES-GCM') {
    return {
      status: 'NOT_READY',
      reason: 'NO_KEY_PROVIDED',
      message: 'Migration cannot proceed: in-memory CryptoKey was not provided or is invalid.',
    };
  }

  // 2. Check Existing Migration State for Idempotency
  let existingState: MigrationStateRecord | null = null;
  try {
    existingState = await getAppState<MigrationStateRecord>(stateKey);
  } catch {
    // Database access error handled below
  }

  if (existingState && existingState.status === 'completed') {
    return {
      status: 'ALREADY_COMPLETED',
      message: 'Migration has already been completed and verified.',
    };
  }

  // 3. Check if legacy storage actually has any data
  if (!hasLegacyData(adapter)) {
    return {
      status: 'NO_MIGRATION_REQUIRED',
      message: 'No legacy localStorage data detected to migrate.',
    };
  }

  // 4. Mark Migration In Progress
  const inProgressState: MigrationStateRecord = {
    version: CURRENT_MIGRATION_VERSION,
    status: 'in_progress',
    startedAt,
    verifiedDatasets: {
      settings: false,
      periods: false,
      dailyLogs: false,
    },
  };

  try {
    await putAppState(stateKey, inProgressState);
  } catch (err) {
    return {
      status: 'FAILED',
      reason: 'DATABASE_ERROR',
      message: 'Failed to record in-progress migration state in IndexedDB.',
    };
  }

  // 4. Read & Validate Legacy Datasets
  let validatedSettings: UserSettings | null = null;
  let validatedPeriods: PeriodEntry[] | null = null;
  let validatedDailyLogs: Record<string, DailyLog> | null = null;

  try {
    if (options?.simulateFailureAt === 'validation') {
      throw new MigrationValidationError('settings', 'Simulated validation failure.');
    }

    // Settings
    const rawSettings = adapter.getItem(LEGACY_STORAGE_KEYS.SETTINGS);
    if (rawSettings !== null && rawSettings.trim().length > 0) {
      let parsedSettings: unknown;
      try {
        parsedSettings = JSON.parse(rawSettings);
      } catch {
        throw new MigrationValidationError('settings', 'Malformed JSON in legacy settings.');
      }
      validatedSettings = validateSettings(parsedSettings);
    }

    // Periods
    const rawPeriods = adapter.getItem(LEGACY_STORAGE_KEYS.PERIODS);
    if (rawPeriods !== null && rawPeriods.trim().length > 0) {
      let parsedPeriods: unknown;
      try {
        parsedPeriods = JSON.parse(rawPeriods);
      } catch {
        throw new MigrationValidationError('periods', 'Malformed JSON in legacy periods.');
      }
      validatedPeriods = validatePeriods(parsedPeriods);
    }

    // Daily Logs
    const rawDailyLogs = adapter.getItem(LEGACY_STORAGE_KEYS.DAILY_LOGS);
    if (rawDailyLogs !== null && rawDailyLogs.trim().length > 0) {
      let parsedDailyLogs: unknown;
      try {
        parsedDailyLogs = JSON.parse(rawDailyLogs);
      } catch {
        throw new MigrationValidationError('daily_logs', 'Malformed JSON in legacy daily logs.');
      }
      validatedDailyLogs = validateDailyLogs(parsedDailyLogs);
    }
  } catch (err) {
    const failureState: MigrationStateRecord = {
      version: CURRENT_MIGRATION_VERSION,
      status: 'failed',
      startedAt,
      failureReason: 'VALIDATION_FAILED',
      verifiedDatasets: {
        settings: false,
        periods: false,
        dailyLogs: false,
      },
    };
    try {
      await putAppState(stateKey, failureState);
    } catch {
      // Safe fail-closed
    }

    return {
      status: 'FAILED',
      reason: 'VALIDATION_FAILED',
      message: err instanceof Error ? err.message : 'Legacy dataset validation failed.',
    };
  }

  // Fallbacks for uninitialized datasets
  const finalSettings: UserSettings = validatedSettings ?? {
    userName: 'Lovely',
    defaultCycleLength: 28,
    defaultPeriodDuration: 5,
    hasCompletedOnboarding: false,
    notifications: {
      periodReminder: true,
      expectedPeriodReminder: true,
      fertileWindowReminder: true,
      dailyTrackingReminder: false,
    },
    activeProfileId: 'default',
  };
  const finalPeriods: PeriodEntry[] = validatedPeriods ?? [];
  const finalDailyLogs: Record<string, DailyLog> = validatedDailyLogs ?? {};

  // 5. Encrypt, Write, Read Back & Verify Each Dataset
  try {
    // 5.1 Settings
    if (options?.simulateFailureAt === 'settings_write') {
      throw new Error('Simulated settings write failure.');
    }
    await saveSecureEntity('settings', settingsId, finalSettings, key);
    const readSettings = await loadSecureEntity<UserSettings>('settings', settingsId, key);
    if (!readSettings || !deepEqual(finalSettings, readSettings)) {
      throw new SecureStorageError(
        'Decrypted settings failed deep equality verification against source.',
        'RECORD_CORRUPTED'
      );
    }

    // 5.2 Periods
    if (options?.simulateFailureAt === 'periods_write') {
      throw new Error('Simulated periods write failure.');
    }
    await saveSecureEntity('periods', periodsId, finalPeriods, key);
    const readPeriods = await loadSecureEntity<PeriodEntry[]>('periods', periodsId, key);
    if (!readPeriods || !deepEqual(finalPeriods, readPeriods)) {
      throw new SecureStorageError(
        'Decrypted periods failed deep equality verification against source.',
        'RECORD_CORRUPTED'
      );
    }

    // 5.3 Daily Logs
    if (options?.simulateFailureAt === 'daily_logs_write') {
      throw new Error('Simulated daily logs write failure.');
    }
    await saveSecureEntity('daily_logs', dailyLogsId, finalDailyLogs, key);
    const readDailyLogs = await loadSecureEntity<Record<string, DailyLog>>('daily_logs', dailyLogsId, key);
    if (!readDailyLogs || !deepEqual(finalDailyLogs, readDailyLogs)) {
      throw new SecureStorageError(
        'Decrypted daily logs failed deep equality verification against source.',
        'RECORD_CORRUPTED'
      );
    }

    // 5.4 Verification simulation hook
    if (options?.simulateFailureAt === 'verification') {
      throw new Error('Simulated verification mismatch.');
    }

    // 5.5 App State Write Hook
    if (options?.simulateFailureAt === 'app_state') {
      throw new Error('Simulated appState write failure.');
    }

    // 6. All Datasets Verified -> Commit Completed Migration State
    const completedAt = new Date().toISOString();
    const completedState: MigrationStateRecord = {
      version: CURRENT_MIGRATION_VERSION,
      status: 'completed',
      startedAt,
      completedAt,
      verifiedDatasets: {
        settings: true,
        periods: true,
        dailyLogs: true,
      },
    };
    await putAppState(stateKey, completedState);

    return {
      status: 'SUCCESS',
      message: 'Migration completed and verified successfully.',
      summary: {
        settingsMigrated: true,
        periodsCount: finalPeriods.length,
        dailyLogsCount: Object.keys(finalDailyLogs).length,
        startedAt,
        completedAt,
        durationMs: Date.now() - new Date(startedAt).getTime(),
      },
    };
  } catch (err) {
    // Fail Closed: Mark status as 'failed', keep source data 100% intact
    let failureReason: MigrationFailureReason = 'UNKNOWN_ERROR';
    if (err instanceof SecureStorageError) {
      if (err.code === 'ENCRYPTION_FAILED') failureReason = 'ENCRYPTION_FAILED';
      else if (err.code === 'DECRYPTION_FAILED') failureReason = 'DECRYPTION_FAILED';
      else if (err.code === 'RECORD_CORRUPTED') failureReason = 'VERIFICATION_MISMATCH';
      else if (err.code === 'DATABASE_ERROR') failureReason = 'DATABASE_ERROR';
    } else if (err instanceof Error && err.message.includes('verification')) {
      failureReason = 'VERIFICATION_MISMATCH';
    }

    const failureState: MigrationStateRecord = {
      version: CURRENT_MIGRATION_VERSION,
      status: 'failed',
      startedAt,
      failureReason,
      verifiedDatasets: {
        settings: false,
        periods: false,
        dailyLogs: false,
      },
    };
    try {
      await putAppState(stateKey, failureState);
    } catch {
      // Safe fail-closed
    }

    return {
      status: 'FAILED',
      reason: failureReason,
      message: 'Migration failed during secure write or verification. Source data was preserved.',
    };
  }
}

// ==========================================
// Cleanup Logic (Gated by Strict Verification)
// ==========================================

/**
 * Removes legacy plaintext keys from legacy storage ONLY after confirmed, verified migration.
 * NEVER calls localStorage.clear().
 * NEVER deletes unrelated keys.
 * Must NOT be invoked automatically in Phase 2B-5.
 */
export async function cleanupLegacyDataAfterVerifiedMigration(
  options?: CleanupOptions
): Promise<CleanupResult> {
  const prefix = options?.partitionPrefix ?? '';
  const stateKey = `${prefix}${MIGRATION_STATE_KEY}`;
  const adapter = options?.storageAdapter ?? getDefaultStorageAdapter();

  let state: MigrationStateRecord | null = null;
  try {
    state = await getAppState<MigrationStateRecord>(stateKey);
  } catch {
    return {
      success: false,
      reason: 'DATABASE_ERROR',
      message: 'Failed to read migration state from IndexedDB.',
      keysRemoved: [],
    };
  }

  const isVerified =
    state !== null &&
    state.status === 'completed' &&
    state.verifiedDatasets?.settings === true &&
    state.verifiedDatasets?.periods === true &&
    state.verifiedDatasets?.dailyLogs === true;

  if (!isVerified) {
    return {
      success: false,
      reason: 'CLEANUP_GUARD_REJECTED',
      message: 'Cleanup rejected: migration has not been fully completed and verified.',
      keysRemoved: [],
    };
  }

  const keysRemoved: string[] = [];
  const targetKeys = [
    LEGACY_STORAGE_KEYS.SETTINGS,
    LEGACY_STORAGE_KEYS.PERIODS,
    LEGACY_STORAGE_KEYS.DAILY_LOGS,
  ];

  for (const key of targetKeys) {
    if (adapter.getItem(key) !== null) {
      adapter.removeItem(key);
      keysRemoved.push(key);
    }
  }

  return {
    success: true,
    message: 'Verified legacy keys successfully removed.',
    keysRemoved,
  };
}

// ==========================================
// Synthetic In-Memory Storage Adapter for Testing
// ==========================================

export class MemoryStorageAdapter implements LegacyStorageAdapter {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// ==========================================
// Automated Synthetic Smoke Test Suite (18 Tests)
// ==========================================

export interface MigrationTestItem {
  testNumber: number;
  testName: string;
  passed: boolean;
  details?: string;
}

export interface MigrationSmokeTestReport {
  success: boolean;
  totalTests: number;
  passedTests: number;
  results: MigrationTestItem[];
  error?: string;
}

/**
 * Executes the complete 18-point synthetic migration test suite.
 * Strictly uses isolated in-memory storage adapters and partitioned IndexedDB namespaces.
 * Leaves 0 trace of test records. Never touches real user localStorage.
 */
export async function runMigrationSmokeTest(): Promise<MigrationSmokeTestReport> {
  const results: MigrationTestItem[] = [];
  const testRunId = `MIGRATION_TEST_${Date.now()}`;
  const prefix = `test_${testRunId}_`;

  const recordTest = (testNumber: number, testName: string, passed: boolean, details?: string) => {
    results.push({ testNumber, testName, passed, details });
  };

  const cleanupPartition = async (testPrefix: string) => {
    try {
      await deleteSecureEntity(`${testPrefix}${RECORD_KEYS.SETTINGS}`);
      await deleteSecureEntity(`${testPrefix}${RECORD_KEYS.PERIODS}`);
      await deleteSecureEntity(`${testPrefix}${RECORD_KEYS.DAILY_LOGS}`);
      await deleteAppState(`${testPrefix}${MIGRATION_STATE_KEY}`);
    } catch {
      // Safe cleanup ignore
    }
  };

  let keyA: CryptoKey;
  let keyB: CryptoKey;

  try {
    const saltA = generateSalt();
    const saltB = generateSalt();
    keyA = await deriveKeyFromPassphrase('MigrationTestKey-Passphrase-A-2026', saltA, 1000);
    keyB = await deriveKeyFromPassphrase('MigrationTestKey-Passphrase-B-9999', saltB, 1000);
  } catch (err) {
    return {
      success: false,
      totalTests: 18,
      passedTests: 0,
      results,
      error: 'Failed to derive test cryptographic keys.',
    };
  }

  // Realistic Synthetic Datasets
  const syntheticValidSettings: UserSettings = {
    userName: 'SECURE_MIGRATION_TEST_USER',
    defaultCycleLength: 29,
    defaultPeriodDuration: 5,
    hasCompletedOnboarding: true,
    notifications: {
      periodReminder: true,
      expectedPeriodReminder: true,
      fertileWindowReminder: false,
      dailyTrackingReminder: true,
    },
    activeProfileId: 'test-profile-1',
  };

  const syntheticValidPeriods: PeriodEntry[] = [
    {
      id: 'test-period-1',
      startDate: '2026-08-01',
      endDate: '2026-08-06',
      flow: 'medium',
      symptoms: ['Cramps', 'Fatigue'] as SymptomType[],
      mood: 'Calm',
      notes: 'SECURE_MIGRATION_TEST_NOTE',
      createdAt: '2026-08-01T08:00:00.000Z',
      updatedAt: '2026-08-06T18:00:00.000Z',
    },
  ];

  const syntheticValidDailyLogs: Record<string, DailyLog> = {
    '2026-08-15': {
      date: '2026-08-15',
      isPeriodDay: false,
      symptoms: ['Headache'] as SymptomType[],
      mood: 'Calm',
      energy: 'normal',
      notes: 'SECURE_MIGRATION_TEST_DAILY_NOTE',
      updatedAt: '2026-08-15T12:00:00.000Z',
    },
  };

  try {
    // ----------------------------------------------------
    // Test 1 — Valid settings
    // ----------------------------------------------------
    const t1Prefix = `${prefix}t1_`;
    const t1Adapter = new MemoryStorageAdapter();
    t1Adapter.setItem(LEGACY_STORAGE_KEYS.SETTINGS, JSON.stringify(syntheticValidSettings));
    const t1Res = await migrateLegacyData(keyA, {
      partitionPrefix: t1Prefix,
      storageAdapter: t1Adapter,
    });
    const t1Loaded = await loadSecureEntity<UserSettings>('settings', `${t1Prefix}${RECORD_KEYS.SETTINGS}`, keyA);
    const t1Pass = t1Res.status === 'SUCCESS' && deepEqual(t1Loaded, syntheticValidSettings);
    recordTest(1, 'Valid settings migration', t1Pass);
    await cleanupPartition(t1Prefix);

    // ----------------------------------------------------
    // Test 2 — Valid periods
    // ----------------------------------------------------
    const t2Prefix = `${prefix}t2_`;
    const t2Adapter = new MemoryStorageAdapter();
    t2Adapter.setItem(LEGACY_STORAGE_KEYS.PERIODS, JSON.stringify(syntheticValidPeriods));
    const t2Res = await migrateLegacyData(keyA, {
      partitionPrefix: t2Prefix,
      storageAdapter: t2Adapter,
    });
    const t2Loaded = await loadSecureEntity<PeriodEntry[]>('periods', `${t2Prefix}${RECORD_KEYS.PERIODS}`, keyA);
    const t2Pass = t2Res.status === 'SUCCESS' && deepEqual(t2Loaded, syntheticValidPeriods);
    recordTest(2, 'Valid periods migration', t2Pass);
    await cleanupPartition(t2Prefix);

    // ----------------------------------------------------
    // Test 3 — Valid daily logs
    // ----------------------------------------------------
    const t3Prefix = `${prefix}t3_`;
    const t3Adapter = new MemoryStorageAdapter();
    t3Adapter.setItem(LEGACY_STORAGE_KEYS.DAILY_LOGS, JSON.stringify(syntheticValidDailyLogs));
    const t3Res = await migrateLegacyData(keyA, {
      partitionPrefix: t3Prefix,
      storageAdapter: t3Adapter,
    });
    const t3Loaded = await loadSecureEntity<Record<string, DailyLog>>('daily_logs', `${t3Prefix}${RECORD_KEYS.DAILY_LOGS}`, keyA);
    const t3Pass = t3Res.status === 'SUCCESS' && deepEqual(t3Loaded, syntheticValidDailyLogs);
    recordTest(3, 'Valid daily logs migration', t3Pass);
    await cleanupPartition(t3Prefix);

    // ----------------------------------------------------
    // Test 4 — Complete migration (All 3 datasets)
    // ----------------------------------------------------
    const t4Prefix = `${prefix}t4_`;
    const t4Adapter = new MemoryStorageAdapter();
    t4Adapter.setItem(LEGACY_STORAGE_KEYS.SETTINGS, JSON.stringify(syntheticValidSettings));
    t4Adapter.setItem(LEGACY_STORAGE_KEYS.PERIODS, JSON.stringify(syntheticValidPeriods));
    t4Adapter.setItem(LEGACY_STORAGE_KEYS.DAILY_LOGS, JSON.stringify(syntheticValidDailyLogs));
    const t4Res = await migrateLegacyData(keyA, {
      partitionPrefix: t4Prefix,
      storageAdapter: t4Adapter,
    });
    const t4State = await getAppState<MigrationStateRecord>(`${t4Prefix}${MIGRATION_STATE_KEY}`);
    const t4Pass =
      t4Res.status === 'SUCCESS' &&
      t4State?.status === 'completed' &&
      t4State.verifiedDatasets.settings &&
      t4State.verifiedDatasets.periods &&
      t4State.verifiedDatasets.dailyLogs;
    recordTest(4, 'Complete migration (all 3 datasets)', t4Pass);
    await cleanupPartition(t4Prefix);

    // ----------------------------------------------------
    // Test 5 — Malformed settings (Reject & preserve source)
    // ----------------------------------------------------
    const t5Prefix = `${prefix}t5_`;
    const t5Adapter = new MemoryStorageAdapter();
    const malformedSettings = { defaultCycleLength: -5, invalid: true };
    t5Adapter.setItem(LEGACY_STORAGE_KEYS.SETTINGS, JSON.stringify(malformedSettings));
    const t5Res = await migrateLegacyData(keyA, {
      partitionPrefix: t5Prefix,
      storageAdapter: t5Adapter,
    });
    const t5SourcePreserved = t5Adapter.getItem(LEGACY_STORAGE_KEYS.SETTINGS) !== null;
    const t5Pass = t5Res.status === 'FAILED' && t5Res.reason === 'VALIDATION_FAILED' && t5SourcePreserved;
    recordTest(5, 'Malformed settings rejection (source preserved)', t5Pass);
    await cleanupPartition(t5Prefix);

    // ----------------------------------------------------
    // Test 6 — Malformed periods (Reject & preserve source)
    // ----------------------------------------------------
    const t6Prefix = `${prefix}t6_`;
    const t6Adapter = new MemoryStorageAdapter();
    const malformedPeriods = [{ id: '', startDate: 'invalid-date' }];
    t6Adapter.setItem(LEGACY_STORAGE_KEYS.PERIODS, JSON.stringify(malformedPeriods));
    const t6Res = await migrateLegacyData(keyA, {
      partitionPrefix: t6Prefix,
      storageAdapter: t6Adapter,
    });
    const t6SourcePreserved = t6Adapter.getItem(LEGACY_STORAGE_KEYS.PERIODS) !== null;
    const t6Pass = t6Res.status === 'FAILED' && t6Res.reason === 'VALIDATION_FAILED' && t6SourcePreserved;
    recordTest(6, 'Malformed periods rejection (source preserved)', t6Pass);
    await cleanupPartition(t6Prefix);

    // ----------------------------------------------------
    // Test 7 — Malformed daily logs (Reject & preserve source)
    // ----------------------------------------------------
    const t7Prefix = `${prefix}t7_`;
    const t7Adapter = new MemoryStorageAdapter();
    const malformedLogs = { 'bad-date': { isPeriodDay: 'not-a-bool' } };
    t7Adapter.setItem(LEGACY_STORAGE_KEYS.DAILY_LOGS, JSON.stringify(malformedLogs));
    const t7Res = await migrateLegacyData(keyA, {
      partitionPrefix: t7Prefix,
      storageAdapter: t7Adapter,
    });
    const t7SourcePreserved = t7Adapter.getItem(LEGACY_STORAGE_KEYS.DAILY_LOGS) !== null;
    const t7Pass = t7Res.status === 'FAILED' && t7Res.reason === 'VALIDATION_FAILED' && t7SourcePreserved;
    recordTest(7, 'Malformed daily logs rejection (source preserved)', t7Pass);
    await cleanupPartition(t7Prefix);

    // ----------------------------------------------------
    // Test 8 — Missing key (NOT_READY, no migration)
    // ----------------------------------------------------
    const t8Prefix = `${prefix}t8_`;
    const t8Adapter = new MemoryStorageAdapter();
    t8Adapter.setItem(LEGACY_STORAGE_KEYS.SETTINGS, JSON.stringify(syntheticValidSettings));
    const t8Res = await migrateLegacyData(null, {
      partitionPrefix: t8Prefix,
      storageAdapter: t8Adapter,
    });
    const t8Pass = t8Res.status === 'NOT_READY' && t8Res.reason === 'NO_KEY_PROVIDED';
    recordTest(8, 'Missing key rejection (NOT_READY)', t8Pass);
    await cleanupPartition(t8Prefix);

    // ----------------------------------------------------
    // Test 9 — Wrong key (Fail closed, no plaintext returned)
    // ----------------------------------------------------
    const t9Prefix = `${prefix}t9_`;
    const t9Adapter = new MemoryStorageAdapter();
    t9Adapter.setItem(LEGACY_STORAGE_KEYS.SETTINGS, JSON.stringify(syntheticValidSettings));
    await migrateLegacyData(keyA, {
      partitionPrefix: t9Prefix,
      storageAdapter: t9Adapter,
    });
    let t9FailedClosed = false;
    try {
      await loadSecureEntity('settings', `${t9Prefix}${RECORD_KEYS.SETTINGS}`, keyB);
    } catch (err) {
      if (err instanceof SecureStorageError && err.code === 'DECRYPTION_FAILED') {
        t9FailedClosed = true;
      }
    }
    recordTest(9, 'Wrong key rejection (Fail closed)', t9FailedClosed);
    await cleanupPartition(t9Prefix);

    // ----------------------------------------------------
    // Test 10 — Tampered encrypted record
    // ----------------------------------------------------
    const t10Prefix = `${prefix}t10_`;
    const t10Adapter = new MemoryStorageAdapter();
    t10Adapter.setItem(LEGACY_STORAGE_KEYS.SETTINGS, JSON.stringify(syntheticValidSettings));
    await migrateLegacyData(keyA, {
      partitionPrefix: t10Prefix,
      storageAdapter: t10Adapter,
    });
    const rawEnvelope = await getEncryptedRecord(`${t10Prefix}${RECORD_KEYS.SETTINGS}`);
    let t10TamperCaught = false;
    if (rawEnvelope) {
      const tamperedBytes = new Uint8Array(rawEnvelope.ciphertext.slice(0));
      tamperedBytes[0] ^= 0xff;
      const tamperedRecord: EncryptedRecordEnvelope = {
        ...rawEnvelope,
        ciphertext: tamperedBytes.buffer,
      };
      await putEncryptedRecord(tamperedRecord);
      try {
        await loadSecureEntity('settings', `${t10Prefix}${RECORD_KEYS.SETTINGS}`, keyA);
      } catch (err) {
        if (err instanceof SecureStorageError && err.code === 'DECRYPTION_FAILED') {
          t10TamperCaught = true;
        }
      }
    }
    recordTest(10, 'Tampered encrypted record rejection', t10TamperCaught);
    await cleanupPartition(t10Prefix);

    // ----------------------------------------------------
    // Test 11 — Verification mismatch
    // ----------------------------------------------------
    const t11Prefix = `${prefix}t11_`;
    const t11Adapter = new MemoryStorageAdapter();
    t11Adapter.setItem(LEGACY_STORAGE_KEYS.SETTINGS, JSON.stringify(syntheticValidSettings));
    const t11Res = await migrateLegacyData(keyA, {
      partitionPrefix: t11Prefix,
      storageAdapter: t11Adapter,
      simulateFailureAt: 'verification',
    });
    const t11Pass = t11Res.status === 'FAILED' && t11Res.reason === 'VERIFICATION_MISMATCH';
    recordTest(11, 'Verification mismatch detection', t11Pass);
    await cleanupPartition(t11Prefix);

    // ----------------------------------------------------
    // Test 12 — Partial migration (Force failure, source intact)
    // ----------------------------------------------------
    const t12Prefix = `${prefix}t12_`;
    const t12Adapter = new MemoryStorageAdapter();
    t12Adapter.setItem(LEGACY_STORAGE_KEYS.SETTINGS, JSON.stringify(syntheticValidSettings));
    t12Adapter.setItem(LEGACY_STORAGE_KEYS.PERIODS, JSON.stringify(syntheticValidPeriods));
    t12Adapter.setItem(LEGACY_STORAGE_KEYS.DAILY_LOGS, JSON.stringify(syntheticValidDailyLogs));
    const t12Res = await migrateLegacyData(keyA, {
      partitionPrefix: t12Prefix,
      storageAdapter: t12Adapter,
      simulateFailureAt: 'daily_logs_write',
    });
    const t12State = await getAppState<MigrationStateRecord>(`${t12Prefix}${MIGRATION_STATE_KEY}`);
    const t12SourcePreserved =
      t12Adapter.getItem(LEGACY_STORAGE_KEYS.SETTINGS) !== null &&
      t12Adapter.getItem(LEGACY_STORAGE_KEYS.PERIODS) !== null &&
      t12Adapter.getItem(LEGACY_STORAGE_KEYS.DAILY_LOGS) !== null;
    const t12Pass = t12Res.status === 'FAILED' && t12State?.status === 'failed' && t12SourcePreserved;
    recordTest(12, 'Partial migration failure handling (source preserved)', t12Pass);

    // ----------------------------------------------------
    // Test 13 — Retry from failed state
    // ----------------------------------------------------
    const t13Res = await migrateLegacyData(keyA, {
      partitionPrefix: t12Prefix,
      storageAdapter: t12Adapter,
    });
    const t13State = await getAppState<MigrationStateRecord>(`${t12Prefix}${MIGRATION_STATE_KEY}`);
    const t13Pass = t13Res.status === 'SUCCESS' && t13State?.status === 'completed';
    recordTest(13, 'Retry execution from failed state', t13Pass);

    // ----------------------------------------------------
    // Test 14 — Already completed (Idempotency)
    // ----------------------------------------------------
    const t14Res = await migrateLegacyData(keyA, {
      partitionPrefix: t12Prefix,
      storageAdapter: t12Adapter,
    });
    const t14Pass = t14Res.status === 'ALREADY_COMPLETED';
    recordTest(14, 'Already completed idempotency', t14Pass);
    await cleanupPartition(t12Prefix);

    // ----------------------------------------------------
    // Test 15 — Key non-persistence
    // ----------------------------------------------------
    let keyNotPersisted = true;
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        const v = k ? window.localStorage.getItem(k) : '';
        if (v && (v.includes('CryptoKey') || v.includes('MigrationTestKey-Passphrase'))) {
          keyNotPersisted = false;
        }
      }
    }
    recordTest(15, 'CryptoKey non-persistence in storage', keyNotPersisted);

    // ----------------------------------------------------
    // Test 16 — Plaintext absence in raw storage
    // ----------------------------------------------------
    const t16Prefix = `${prefix}t16_`;
    const t16Adapter = new MemoryStorageAdapter();
    t16Adapter.setItem(LEGACY_STORAGE_KEYS.PERIODS, JSON.stringify(syntheticValidPeriods));
    await migrateLegacyData(keyA, {
      partitionPrefix: t16Prefix,
      storageAdapter: t16Adapter,
    });
    const t16Envelope = await getEncryptedRecord(`${t16Prefix}${RECORD_KEYS.PERIODS}`);
    let plaintextAbsent = false;
    if (t16Envelope) {
      const jsonStr = JSON.stringify(t16Envelope);
      const inEnvelope = jsonStr.includes('SECURE_MIGRATION_TEST_NOTE');
      const bytes = new Uint8Array(t16Envelope.ciphertext);
      const ascii = String.fromCharCode(...bytes.slice(0, 100));
      const inCiphertext = ascii.includes('SECURE_MIGRATION_TEST_NOTE');
      plaintextAbsent = !inEnvelope && !inCiphertext;
    }
    recordTest(16, 'Plaintext absence in raw IndexedDB storage', plaintextAbsent);
    await cleanupPartition(t16Prefix);

    // ----------------------------------------------------
    // Test 17 — Unicode round-trip fidelity
    // ----------------------------------------------------
    const t17Prefix = `${prefix}t17_`;
    const t17Adapter = new MemoryStorageAdapter();
    const unicodePeriods: PeriodEntry[] = [
      {
        id: 'unicode-period-1',
        startDate: '2026-09-01',
        endDate: '2026-09-05',
        flow: 'medium',
        symptoms: ['Cramps'] as SymptomType[],
        mood: 'Calm',
        notes: 'English text. こんにちは 🌸. मासिक धर्म चक्र नमस्ते 🩸. 🔐✨',
        createdAt: '2026-09-01T08:00:00.000Z',
        updatedAt: '2026-09-05T19:00:00.000Z',
      },
    ];
    t17Adapter.setItem(LEGACY_STORAGE_KEYS.PERIODS, JSON.stringify(unicodePeriods));
    await migrateLegacyData(keyA, {
      partitionPrefix: t17Prefix,
      storageAdapter: t17Adapter,
    });
    const t17Loaded = await loadSecureEntity<PeriodEntry[]>('periods', `${t17Prefix}${RECORD_KEYS.PERIODS}`, keyA);
    const t17Pass =
      t17Loaded !== null &&
      t17Loaded[0].notes === unicodePeriods[0].notes &&
      t17Loaded[0].notes.includes('こんにちは') &&
      t17Loaded[0].notes.includes('नमस्ते') &&
      t17Loaded[0].notes.includes('🔐✨');
    recordTest(17, 'Unicode & multilingual fidelity round-trip', t17Pass);
    await cleanupPartition(t17Prefix);

    // ----------------------------------------------------
    // Test 18 — Cleanup guard rejection
    // ----------------------------------------------------
    const t18Prefix = `${prefix}t18_`;
    const t18Adapter = new MemoryStorageAdapter();
    t18Adapter.setItem(LEGACY_STORAGE_KEYS.SETTINGS, JSON.stringify(syntheticValidSettings));
    // Attempt cleanup when status is not_started / failed
    const t18Res = await cleanupLegacyDataAfterVerifiedMigration({
      partitionPrefix: t18Prefix,
      storageAdapter: t18Adapter,
    });
    const t18KeysPreserved = t18Adapter.getItem(LEGACY_STORAGE_KEYS.SETTINGS) !== null;
    const t18Pass =
      t18Res.success === false &&
      t18Res.reason === 'CLEANUP_GUARD_REJECTED' &&
      t18KeysPreserved;
    recordTest(18, 'Cleanup guard rejection without completed state', t18Pass);
    await cleanupPartition(t18Prefix);

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
