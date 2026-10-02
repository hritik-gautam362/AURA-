/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AppStateEntry,
  EncryptedRecordEnvelope,
  VaultDatabaseError,
  VaultMetadata,
} from './storageTypes';

export const DB_NAME = 'aura_cycle_vault_db';
export const DB_VERSION = 1;

export const STORES = {
  METADATA: 'metadata',
  ENCRYPTED_RECORDS: 'encryptedRecords',
  APP_STATE: 'appState',
} as const;

export const INDEXES = {
  BY_ENTITY_TYPE: 'by_entity_type',
  BY_UPDATED_AT: 'by_updated_at',
} as const;

let dbInstance: IDBDatabase | null = null;
let dbOpeningPromise: Promise<IDBDatabase> | null = null;

/**
 * Checks whether native IndexedDB is available and accessible in the current browser runtime.
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Opens or retrieves the shared connection to the vault IndexedDB database.
 * Handles initial store creation and deterministic version upgrades.
 */
export async function openVaultDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbOpeningPromise) {
    return dbOpeningPromise;
  }

  if (!isIndexedDBAvailable()) {
    throw new VaultDatabaseError(
      'IndexedDB is not available or blocked in this browser environment.',
      'INDEXEDDB_UNAVAILABLE'
    );
  }

  dbOpeningPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;

    try {
      request = window.indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      dbOpeningPromise = null;
      return reject(
        new VaultDatabaseError('Failed to initiate IndexedDB open request.', 'DATABASE_OPEN_FAILED', err)
      );
    }

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // Version 1 Schema Initialization
      if (oldVersion < 1) {
        // 1. Metadata Store (Non-sensitive vault configuration)
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'id' });
        }

        // 2. Encrypted Records Store (AES-256-GCM encrypted envelopes)
        if (!db.objectStoreNames.contains(STORES.ENCRYPTED_RECORDS)) {
          const recordStore = db.createObjectStore(STORES.ENCRYPTED_RECORDS, { keyPath: 'id' });
          recordStore.createIndex(INDEXES.BY_ENTITY_TYPE, 'entityType', { unique: false });
          recordStore.createIndex(INDEXES.BY_UPDATED_AT, 'updatedAt', { unique: false });
        }

        // 3. Operational App State Store (Non-health operational flags)
        if (!db.objectStoreNames.contains(STORES.APP_STATE)) {
          db.createObjectStore(STORES.APP_STATE, { keyPath: 'key' });
        }
      }
    };

    request.onblocked = () => {
      dbOpeningPromise = null;
      reject(
        new VaultDatabaseError(
          'Database upgrade blocked. An older connection is still open in another tab.',
          'UPGRADE_BLOCKED'
        )
      );
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbOpeningPromise = null;

      // Handle unexpected connection terminations (e.g. database deleted externally)
      dbInstance.onclose = () => {
        dbInstance = null;
      };

      dbInstance.onversionchange = () => {
        // Close connection gracefully if another tab requests a schema upgrade
        dbInstance?.close();
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onerror = () => {
      dbOpeningPromise = null;
      const error = request.error;
      const isQuota = error?.name === 'QuotaExceededError';
      reject(
        new VaultDatabaseError(
          error?.message || 'Failed to open vault IndexedDB database.',
          isQuota ? 'QUOTA_EXCEEDED' : 'DATABASE_OPEN_FAILED',
          error
        )
      );
    };
  });

  return dbOpeningPromise;
}

/**
 * Closes the active database connection if open and resets cached instance.
 */
export function closeVaultDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  dbOpeningPromise = null;
}

/**
 * Generic helper executing a callback within an isolated, monitored IndexedDB transaction.
 */
export async function withTransaction<T>(
  storeNames: (typeof STORES)[keyof typeof STORES][],
  mode: IDBTransactionMode,
  callback: (tx: IDBTransaction) => Promise<T> | T
): Promise<T> {
  const db = await openVaultDatabase();

  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(storeNames, mode);
    } catch (err) {
      return reject(
        new VaultDatabaseError(
          `Failed to initiate transaction on stores: ${storeNames.join(', ')}`,
          'TRANSACTION_FAILED',
          err
        )
      );
    }

    let result: T;
    let callbackPromise: Promise<T> | null = null;

    tx.oncomplete = () => {
      resolve(result);
    };

    tx.onerror = () => {
      const error = tx.error;
      const isQuota = error?.name === 'QuotaExceededError';
      reject(
        new VaultDatabaseError(
          error?.message || 'IndexedDB transaction failed.',
          isQuota ? 'QUOTA_EXCEEDED' : 'TRANSACTION_FAILED',
          error
        )
      );
    };

    tx.onabort = () => {
      reject(
        new VaultDatabaseError(
          tx.error?.message || 'IndexedDB transaction was aborted.',
          'TRANSACTION_FAILED',
          tx.error
        )
      );
    };

    try {
      const maybePromise = callback(tx);
      if (maybePromise instanceof Promise) {
        callbackPromise = maybePromise;
        callbackPromise
          .then((res) => {
            result = res;
          })
          .catch((err) => {
            try {
              tx.abort();
            } catch {
              // Ignore if already aborted
            }
            reject(err);
          });
      } else {
        result = maybePromise;
      }
    } catch (err) {
      try {
        tx.abort();
      } catch {
        // Ignore if already aborted
      }
      reject(err);
    }
  });
}

// ==========================================
// Low-Level Metadata CRUD Helpers
// ==========================================

export async function putMetadata(metadata: VaultMetadata): Promise<void> {
  await withTransaction([STORES.METADATA], 'readwrite', (tx) => {
    const store = tx.objectStore(STORES.METADATA);
    store.put(metadata);
  });
}

export async function getMetadata(id: string): Promise<VaultMetadata | null> {
  return withTransaction([STORES.METADATA], 'readonly', (tx) => {
    return new Promise<VaultMetadata | null>((resolve, reject) => {
      const store = tx.objectStore(STORES.METADATA);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve((request.result as VaultMetadata) || null);
      };

      request.onerror = () => {
        reject(
          new VaultDatabaseError(
            `Failed to read metadata with id "${id}".`,
            'TRANSACTION_FAILED',
            request.error
          )
        );
      };
    });
  });
}

export async function deleteMetadata(id: string): Promise<void> {
  await withTransaction([STORES.METADATA], 'readwrite', (tx) => {
    const store = tx.objectStore(STORES.METADATA);
    store.delete(id);
  });
}

// ==========================================
// Low-Level Encrypted Record CRUD Helpers
// ==========================================

export async function putEncryptedRecord(record: EncryptedRecordEnvelope): Promise<void> {
  await withTransaction([STORES.ENCRYPTED_RECORDS], 'readwrite', (tx) => {
    const store = tx.objectStore(STORES.ENCRYPTED_RECORDS);
    store.put(record);
  });
}

export async function getEncryptedRecord(id: string): Promise<EncryptedRecordEnvelope | null> {
  return withTransaction([STORES.ENCRYPTED_RECORDS], 'readonly', (tx) => {
    return new Promise<EncryptedRecordEnvelope | null>((resolve, reject) => {
      const store = tx.objectStore(STORES.ENCRYPTED_RECORDS);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve((request.result as EncryptedRecordEnvelope) || null);
      };

      request.onerror = () => {
        reject(
          new VaultDatabaseError(
            `Failed to read encrypted record with id "${id}".`,
            'TRANSACTION_FAILED',
            request.error
          )
        );
      };
    });
  });
}

export async function getEncryptedRecordsByEntityType(
  entityType: string
): Promise<EncryptedRecordEnvelope[]> {
  return withTransaction([STORES.ENCRYPTED_RECORDS], 'readonly', (tx) => {
    return new Promise<EncryptedRecordEnvelope[]>((resolve, reject) => {
      const store = tx.objectStore(STORES.ENCRYPTED_RECORDS);
      const index = store.index(INDEXES.BY_ENTITY_TYPE);
      const request = index.getAll(entityType);

      request.onsuccess = () => {
        resolve((request.result as EncryptedRecordEnvelope[]) || []);
      };

      request.onerror = () => {
        reject(
          new VaultDatabaseError(
            `Failed to query records for entityType "${entityType}".`,
            'TRANSACTION_FAILED',
            request.error
          )
        );
      };
    });
  });
}

export async function deleteEncryptedRecord(id: string): Promise<void> {
  await withTransaction([STORES.ENCRYPTED_RECORDS], 'readwrite', (tx) => {
    const store = tx.objectStore(STORES.ENCRYPTED_RECORDS);
    store.delete(id);
  });
}

// ==========================================
// Low-Level App State CRUD Helpers
// ==========================================

export async function putAppState<T>(key: string, value: T): Promise<void> {
  const entry: AppStateEntry<T> = {
    key,
    value,
    updatedAt: new Date().toISOString(),
  };

  await withTransaction([STORES.APP_STATE], 'readwrite', (tx) => {
    const store = tx.objectStore(STORES.APP_STATE);
    store.put(entry);
  });
}

export async function getAppState<T>(key: string): Promise<T | null> {
  return withTransaction([STORES.APP_STATE], 'readonly', (tx) => {
    return new Promise<T | null>((resolve, reject) => {
      const store = tx.objectStore(STORES.APP_STATE);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as AppStateEntry<T> | undefined;
        resolve(entry !== undefined ? entry.value : null);
      };

      request.onerror = () => {
        reject(
          new VaultDatabaseError(
            `Failed to read app state for key "${key}".`,
            'TRANSACTION_FAILED',
            request.error
          )
        );
      };
    });
  });
}

export async function deleteAppState(key: string): Promise<void> {
  await withTransaction([STORES.APP_STATE], 'readwrite', (tx) => {
    const store = tx.objectStore(STORES.APP_STATE);
    store.delete(key);
  });
}

// ==========================================
// Smoke Test Routine (Synthetic Data Only)
// ==========================================

export interface SmokeTestResult {
  success: boolean;
  stepsCompleted: string[];
  error?: string;
}

/**
 * Runs a deterministic smoke test against IndexedDB using synthetic, non-health data.
 * Verifies database opening, store creation, CRUD across all 3 stores, indexes,
 * and transactions. Cleans up all test entities upon completion.
 */
export async function runDatabaseSmokeTest(): Promise<SmokeTestResult> {
  const steps: string[] = [];
  const testId = `smoke-test-${Date.now()}`;

  try {
    // 1. Open database
    const db = await openVaultDatabase();
    if (!db || db.name !== DB_NAME) {
      throw new Error(`Database name mismatch: expected ${DB_NAME}, got ${db?.name}`);
    }
    steps.push('Database opened successfully');

    // 2. Verify all stores exist
    const storeNames = Array.from(db.objectStoreNames);
    const requiredStores = [STORES.METADATA, STORES.ENCRYPTED_RECORDS, STORES.APP_STATE];
    for (const required of requiredStores) {
      if (!storeNames.includes(required)) {
        throw new Error(`Missing required object store: ${required}`);
      }
    }
    steps.push('All 3 object stores verified');

    // 3. Metadata store CRUD
    const dummySalt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const testMeta: VaultMetadata = {
      id: testId,
      schemaVersion: 1,
      algorithm: 'AES-256-GCM',
      kdfAlgorithm: 'PBKDF2-SHA-256',
      kdfIterations: 600000,
      salt: dummySalt,
      keyVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await putMetadata(testMeta);
    const readMeta = await getMetadata(testId);
    if (!readMeta || readMeta.kdfIterations !== 600000) {
      throw new Error('Metadata write/read verification failed');
    }
    await deleteMetadata(testId);
    const deletedMeta = await getMetadata(testId);
    if (deletedMeta !== null) {
      throw new Error('Metadata deletion verification failed');
    }
    steps.push('Metadata store CRUD verified');

    // 4. Encrypted record store CRUD & Index query
    const dummyIV = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
    const dummyCiphertext = new Uint8Array([99, 88, 77, 66, 55, 44]).buffer;
    const testRecord: EncryptedRecordEnvelope = {
      id: testId,
      entityType: 'test_entity',
      recordVersion: 1,
      algorithm: 'AES-256-GCM',
      keyVersion: 1,
      iv: dummyIV,
      ciphertext: dummyCiphertext,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await putEncryptedRecord(testRecord);
    const readRecord = await getEncryptedRecord(testId);
    if (!readRecord || readRecord.entityType !== 'test_entity') {
      throw new Error('Encrypted record write/read verification failed');
    }

    // 5. Index query
    const recordsByType = await getEncryptedRecordsByEntityType('test_entity');
    if (!recordsByType.some((r) => r.id === testId)) {
      throw new Error('Index query by entityType failed');
    }
    await deleteEncryptedRecord(testId);
    const deletedRecord = await getEncryptedRecord(testId);
    if (deletedRecord !== null) {
      throw new Error('Encrypted record deletion verification failed');
    }
    steps.push('EncryptedRecords CRUD and index query verified');

    // 6. App state store CRUD
    await putAppState(testId, { testPassed: true });
    const readState = await getAppState<{ testPassed: boolean }>(testId);
    if (!readState || !readState.testPassed) {
      throw new Error('App state write/read verification failed');
    }
    await deleteAppState(testId);
    const deletedState = await getAppState(testId);
    if (deletedState !== null) {
      throw new Error('App state deletion verification failed');
    }
    steps.push('AppState store CRUD verified');

    return {
      success: true,
      stepsCompleted: steps,
    };
  } catch (err: unknown) {
    // Attempt cleanup if failed
    try {
      await deleteMetadata(testId);
      await deleteEncryptedRecord(testId);
      await deleteAppState(testId);
    } catch {
      // Ignore cleanup error
    }
    return {
      success: false,
      stepsCompleted: steps,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
