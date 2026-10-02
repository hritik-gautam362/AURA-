/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Supported cryptographic algorithms for vault records
 */
export type VaultAlgorithm = 'AES-256-GCM';

/**
 * Non-sensitive metadata describing vault configuration and key parameters.
 * Does NOT store actual keys, passcodes, or secrets.
 */
export interface VaultMetadata {
  id: string; // Identifier, e.g. 'vault_meta'
  schemaVersion: number; // Database schema version (e.g. 1)
  algorithm: VaultAlgorithm; // Cipher algorithm identifier
  kdfAlgorithm: 'PBKDF2-SHA-256'; // Key derivation function
  kdfIterations: number; // e.g. 600000
  salt: Uint8Array; // 16-byte random salt for KDF
  keyVersion: number; // Monotonic key version for rotation tracking
  createdAt: string; // ISO-8601 timestamp
  updatedAt: string; // ISO-8601 timestamp
}

/**
 * Strongly typed envelope for storing encrypted payloads in IndexedDB.
 * Maintains binary representations for cryptographic attributes (IV, ciphertext + tag).
 */
export interface EncryptedRecordEnvelope {
  id: string; // Record partition key (e.g. 'periods_root' or UUID)
  entityType: string; // Logical entity type, e.g. 'periods' | 'daily_logs' | 'settings' | 'test'
  recordVersion: number; // Schema version of the encapsulated plaintext
  algorithm: VaultAlgorithm; // Cipher algorithm used for this record
  keyVersion: number; // Key version used to encrypt this record
  iv: Uint8Array; // 96-bit (12-byte) initialization vector (NEVER reused)
  ciphertext: ArrayBuffer; // Encrypted data with appended 128-bit GCM authentication tag
  createdAt: string; // ISO-8601 timestamp
  updatedAt: string; // ISO-8601 timestamp
}

/**
 * Operational application state that must persist locally.
 * Does NOT contain sensitive health data or cryptographic keys.
 */
export interface AppStateEntry<T = unknown> {
  key: string; // Operational key, e.g. 'migration_completed' | 'app_lock_enabled'
  value: T; // Typed JSON-serializable value
  updatedAt: string; // ISO-8601 timestamp
}

/**
 * Standard error codes for Vault Database operations
 */
export type VaultDatabaseErrorCode =
  | 'INDEXEDDB_UNAVAILABLE'
  | 'DATABASE_OPEN_FAILED'
  | 'UPGRADE_BLOCKED'
  | 'TRANSACTION_FAILED'
  | 'QUOTA_EXCEEDED'
  | 'RECORD_NOT_FOUND'
  | 'INVALID_DATA'
  | 'UNKNOWN';

/**
 * Strongly typed error representing failures within the IndexedDB storage layer.
 */
export class VaultDatabaseError extends Error {
  readonly code: VaultDatabaseErrorCode;
  readonly originalError?: unknown;

  constructor(message: string, code: VaultDatabaseErrorCode, originalError?: unknown) {
    super(message);
    this.name = 'VaultDatabaseError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Permitted secure entity types for domain health data and settings
 */
export type SecureEntityType = 'periods' | 'daily_logs' | 'settings' | 'test' | 'verification';

/**
 * Standard error codes for Secure Storage operations
 */
export type SecureStorageErrorCode =
  | 'INVALID_KEY'
  | 'ENCRYPTION_FAILED'
  | 'DECRYPTION_FAILED'
  | 'SERIALIZATION_FAILED'
  | 'DESERIALIZATION_FAILED'
  | 'RECORD_CORRUPTED'
  | 'UNSUPPORTED_VERSION'
  | 'DATABASE_ERROR'
  | 'INVALID_ENTITY_TYPE';

/**
 * Strongly typed error representing high-level secure storage failures.
 * Never leaks raw keys, passcodes, or plaintext health data in error messages.
 */
export class SecureStorageError extends Error {
  readonly code: SecureStorageErrorCode;
  readonly originalError?: unknown;

  constructor(message: string, code: SecureStorageErrorCode, originalError?: unknown) {
    super(message);
    this.name = 'SecureStorageError';
    this.code = code;
    this.originalError = originalError;
  }
}

