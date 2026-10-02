/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VaultAlgorithm } from '../storage/storageTypes';

/**
 * Versioned cryptographic parameters configuration
 */
export interface CryptoConfiguration {
  readonly cryptoVersion: number;
  readonly algorithm: VaultAlgorithm;
  readonly kdfAlgorithm: 'PBKDF2-SHA-256';
  readonly kdfIterations: number;
  readonly saltByteLength: number;
  readonly ivByteLength: number;
  readonly tagBitLength: number;
  readonly keyBitLength: number;
}

/**
 * Standard crypto envelope containing ciphertext and its cryptographic parameters.
 * Maintains binary representations for IV and ciphertext (with authentication tag).
 */
export interface CryptoEnvelope {
  readonly cryptoVersion: number;
  readonly algorithm: VaultAlgorithm;
  readonly iv: Uint8Array;
  readonly ciphertext: ArrayBuffer;
}

/**
 * Structured options for encryption
 */
export interface EncryptOptions {
  readonly aad?: string | Uint8Array;
}

/**
 * Structured options for decryption
 */
export interface DecryptOptions {
  readonly aad?: string | Uint8Array;
}

/**
 * Error codes for cryptographic operations
 */
export type CryptoErrorCode =
  | 'WEB_CRYPTO_UNAVAILABLE'
  | 'KEY_DERIVATION_FAILED'
  | 'ENCRYPTION_FAILED'
  | 'DECRYPTION_FAILED'
  | 'AUTHENTICATION_FAILED'
  | 'UNSUPPORTED_CRYPTO_VERSION'
  | 'UNSUPPORTED_ALGORITHM'
  | 'INVALID_IV'
  | 'INVALID_PAYLOAD'
  | 'INVALID_PARAM'
  | 'INVALID_PASSPHRASE';

/**
 * Strongly typed error representing cryptographic failures.
 * Never includes raw keys, plaintext, or sensitive payloads in error messages.
 */
export class CryptoError extends Error {
  readonly code: CryptoErrorCode;
  readonly originalError?: unknown;

  constructor(message: string, code: CryptoErrorCode, originalError?: unknown) {
    super(message);
    this.name = 'CryptoError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Strongly typed states for the App Lock state machine
 */
export type LockState = 'uninitialized' | 'locked' | 'unlocking' | 'unlocked' | 'locking' | 'error';

/**
 * Standard error codes for key management and vault access
 */
export type SecurityErrorCode =
  | 'VAULT_LOCKED'
  | 'VAULT_ALREADY_INITIALIZED'
  | 'VAULT_NOT_INITIALIZED'
  | 'INVALID_PIN'
  | 'WEAK_PIN'
  | 'PIN_MISMATCH'
  | 'RATE_LIMITED'
  | 'VERIFICATION_FAILED'
  | 'CORRUPTED_METADATA'
  | 'DATABASE_ERROR'
  | 'STORAGE_ERROR'
  | 'CRYPTO_ERROR'
  | 'UNKNOWN_SECURITY_ERROR';

/**
 * Strongly typed security error that never leaks PINs, raw keys, or sensitive health data.
 */
export class SecurityError extends Error {
  readonly code: SecurityErrorCode;
  readonly originalError?: unknown;

  constructor(code: SecurityErrorCode, message: string, originalError?: unknown) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Internal verification record structure stored encrypted in IndexedDB.
 * Proves that a derived key is correct via AES-GCM tag verification.
 */
export interface VaultVerificationPayload {
  readonly type: 'vault_verification';
  readonly version: number;
  readonly value: string;
  readonly createdAt: string;
}

