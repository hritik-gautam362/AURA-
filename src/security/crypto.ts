/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CryptoConfiguration,
  CryptoEnvelope,
  CryptoError,
  DecryptOptions,
  EncryptOptions,
} from './securityTypes';

/**
 * Standardized, versioned cryptographic parameters.
 * 600,000 PBKDF2 iterations as mandated by the approved security architecture.
 */
export const CURRENT_CRYPTO_CONFIG: CryptoConfiguration = Object.freeze({
  cryptoVersion: 1,
  algorithm: 'AES-256-GCM',
  kdfAlgorithm: 'PBKDF2-SHA-256',
  kdfIterations: 600_000,
  saltByteLength: 16, // 128-bit salt
  ivByteLength: 12, // 96-bit IV (NIST recommended for GCM)
  tagBitLength: 128, // 16-byte authentication tag
  keyBitLength: 256, // AES-256
});

/**
 * Detects whether the native Web Crypto API (crypto.subtle) is available and functional.
 */
export function isWebCryptoAvailable(): boolean {
  try {
    const cryptoObj =
      typeof window !== 'undefined' && window.crypto ? window.crypto : globalThis.crypto;
    return typeof cryptoObj !== 'undefined' && typeof cryptoObj.subtle !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Retrieves the crypto instance or fails closed.
 */
function getSubtleCrypto(): SubtleCrypto {
  const cryptoObj =
    typeof window !== 'undefined' && window.crypto ? window.crypto : globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new CryptoError(
      'Web Crypto API (crypto.subtle) is not available in this environment. Cannot perform cryptographic operations.',
      'WEB_CRYPTO_UNAVAILABLE'
    );
  }
  return cryptoObj.subtle;
}

/**
 * Generates a cryptographically secure random salt for PBKDF2 key derivation.
 * Salt is public/non-secret, but must be unique per vault.
 */
export function generateSalt(byteLength: number = CURRENT_CRYPTO_CONFIG.saltByteLength): Uint8Array {
  if (byteLength < 16) {
    throw new CryptoError('Salt length must be at least 16 bytes (128 bits).', 'INVALID_PARAM');
  }
  const cryptoObj =
    typeof window !== 'undefined' && window.crypto ? window.crypto : globalThis.crypto;
  if (!cryptoObj || !cryptoObj.getRandomValues) {
    throw new CryptoError('Secure random generator is not available.', 'WEB_CRYPTO_UNAVAILABLE');
  }
  const salt = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(salt);
  return salt;
}

/**
 * Generates a fresh, cryptographically random 96-bit (12-byte) IV for AES-GCM.
 * An IV must NEVER be reused with the same AES-GCM key.
 */
export function generateIV(): Uint8Array {
  const cryptoObj =
    typeof window !== 'undefined' && window.crypto ? window.crypto : globalThis.crypto;
  if (!cryptoObj || !cryptoObj.getRandomValues) {
    throw new CryptoError('Secure random generator is not available.', 'WEB_CRYPTO_UNAVAILABLE');
  }
  const iv = new Uint8Array(CURRENT_CRYPTO_CONFIG.ivByteLength);
  cryptoObj.getRandomValues(iv);
  return iv;
}

/**
 * Derives a non-exportable 256-bit AES-GCM CryptoKey from a user passphrase/PIN
 * using PBKDF2-HMAC-SHA-256 with 600,000 iterations.
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = CURRENT_CRYPTO_CONFIG.kdfIterations
): Promise<CryptoKey> {
  if (!passphrase || typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new CryptoError('Passphrase must be a non-empty string.', 'INVALID_PASSPHRASE');
  }
  if (!salt || !(salt instanceof Uint8Array) || salt.byteLength < 16) {
    throw new CryptoError('Salt must be a Uint8Array of at least 16 bytes.', 'INVALID_PARAM');
  }

  const subtle = getSubtleCrypto();

  try {
    const passphraseBytes = new TextEncoder().encode(passphrase);

    // 1. Import raw passphrase as a base PBKDF2 key
    const baseKey = await subtle.importKey(
      'raw',
      passphraseBytes,
      'PBKDF2',
      false, // non-extractable base key
      ['deriveKey']
    );

    // 2. Derive non-exportable AES-GCM 256-bit CryptoKey
    const derivedKey = await subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256',
      },
      baseKey,
      {
        name: 'AES-GCM',
        length: CURRENT_CRYPTO_CONFIG.keyBitLength,
      },
      false, // non-exportable CryptoKey: raw key bytes cannot be extracted via JavaScript
      ['encrypt', 'decrypt']
    );

    return derivedKey;
  } catch (err) {
    throw new CryptoError('Key derivation failed.', 'KEY_DERIVATION_FAILED', err);
  }
}

/**
 * Encrypts arbitrary plaintext (string or binary) using AES-256-GCM.
 * Generates a fresh 96-bit IV for every call and attaches a 128-bit authentication tag.
 * Binds optional Additional Authenticated Data (AAD) to prevent ciphertext swap attacks.
 */
export async function encryptData(
  plaintext: string | Uint8Array,
  key: CryptoKey,
  options?: EncryptOptions
): Promise<CryptoEnvelope> {
  if (!key) {
    throw new CryptoError('Valid CryptoKey is required for encryption.', 'INVALID_PARAM');
  }

  const subtle = getSubtleCrypto();
  const iv = generateIV();

  // Prepare data bytes
  const dataBytes =
    typeof plaintext === 'string' ? new TextEncoder().encode(plaintext) : plaintext;

  // Prepare Additional Authenticated Data (AAD) if provided
  let additionalData: Uint8Array | undefined = undefined;
  if (options?.aad) {
    additionalData =
      typeof options.aad === 'string' ? new TextEncoder().encode(options.aad) : options.aad;
  }

  const gcmParams: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv,
    tagLength: CURRENT_CRYPTO_CONFIG.tagBitLength,
    ...(additionalData ? { additionalData } : {}),
  };

  try {
    const ciphertext = await subtle.encrypt(gcmParams, key, dataBytes);

    return {
      cryptoVersion: CURRENT_CRYPTO_CONFIG.cryptoVersion,
      algorithm: CURRENT_CRYPTO_CONFIG.algorithm,
      iv: iv,
      ciphertext: ciphertext,
    };
  } catch (err) {
    throw new CryptoError('Encryption operation failed.', 'ENCRYPTION_FAILED', err);
  }
}

/**
 * Decrypts a versioned CryptoEnvelope using AES-256-GCM and verifies authenticity.
 * Fails closed if the key, IV, AAD, or ciphertext have been altered.
 * Returns the decoded UTF-8 string.
 */
export async function decryptData(
  envelope: CryptoEnvelope,
  key: CryptoKey,
  options?: DecryptOptions
): Promise<string> {
  const decryptedBytes = await decryptDataToBytes(envelope, key, options);

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(decryptedBytes);
  } catch (err) {
    throw new CryptoError(
      'Decrypted payload contains invalid UTF-8 encoding.',
      'DECRYPTION_FAILED',
      err
    );
  }
}

/**
 * Decrypts a versioned CryptoEnvelope to raw binary Uint8Array bytes.
 * Validates versioning, algorithm, IV size, and authentication tag.
 */
export async function decryptDataToBytes(
  envelope: CryptoEnvelope,
  key: CryptoKey,
  options?: DecryptOptions
): Promise<Uint8Array> {
  if (!envelope) {
    throw new CryptoError('CryptoEnvelope payload is missing.', 'INVALID_PAYLOAD');
  }

  // Version validation
  if (envelope.cryptoVersion !== CURRENT_CRYPTO_CONFIG.cryptoVersion) {
    throw new CryptoError(
      `Unsupported crypto version: ${envelope.cryptoVersion}. Expected ${CURRENT_CRYPTO_CONFIG.cryptoVersion}.`,
      'UNSUPPORTED_CRYPTO_VERSION'
    );
  }

  // Algorithm validation
  if (envelope.algorithm !== CURRENT_CRYPTO_CONFIG.algorithm) {
    throw new CryptoError(
      `Unsupported algorithm: ${envelope.algorithm}. Expected ${CURRENT_CRYPTO_CONFIG.algorithm}.`,
      'UNSUPPORTED_ALGORITHM'
    );
  }

  // IV validation
  if (!envelope.iv || !(envelope.iv instanceof Uint8Array) || envelope.iv.byteLength !== 12) {
    throw new CryptoError('Invalid IV: must be a 12-byte Uint8Array.', 'INVALID_IV');
  }

  // Ciphertext validation (minimum 16 bytes for 128-bit authentication tag)
  if (
    !envelope.ciphertext ||
    !(envelope.ciphertext instanceof ArrayBuffer) ||
    envelope.ciphertext.byteLength < 16
  ) {
    throw new CryptoError(
      'Invalid ciphertext: payload is missing or too short to contain authentication tag.',
      'INVALID_PAYLOAD'
    );
  }

  if (!key) {
    throw new CryptoError('Valid CryptoKey is required for decryption.', 'INVALID_PARAM');
  }

  const subtle = getSubtleCrypto();

  // Prepare Additional Authenticated Data (AAD) if provided
  let additionalData: Uint8Array | undefined = undefined;
  if (options?.aad) {
    additionalData =
      typeof options.aad === 'string' ? new TextEncoder().encode(options.aad) : options.aad;
  }

  const gcmParams: AesGcmParams = {
    name: 'AES-GCM',
    iv: envelope.iv,
    tagLength: CURRENT_CRYPTO_CONFIG.tagBitLength,
    ...(additionalData ? { additionalData } : {}),
  };

  try {
    const decryptedBuffer = await subtle.decrypt(gcmParams, key, envelope.ciphertext);
    return new Uint8Array(decryptedBuffer);
  } catch (err) {
    // Web Crypto subtle.decrypt rejects with OperationError upon tag mismatch, wrong key, or wrong AAD
    throw new CryptoError(
      'Authentication failed: invalid key, mismatched AAD, or tampered ciphertext.',
      'AUTHENTICATION_FAILED',
      err
    );
  }
}

// ==========================================
// Comprehensive Synthetic Crypto Smoke Test
// ==========================================

export interface CryptoSmokeTestItem {
  testName: string;
  passed: boolean;
  details?: string;
}

export interface CryptoSmokeTestReport {
  success: boolean;
  totalTests: number;
  passedTests: number;
  results: CryptoSmokeTestItem[];
  error?: string;
}

/**
 * Runs an exhaustive, deterministic suite of synthetic cryptographic tests.
 * Validates key derivation, encryption, decryption, authentication failure modes,
 * IV uniqueness, Unicode/emojis, large payloads, and version enforcement.
 */
export async function runCryptoSmokeTest(): Promise<CryptoSmokeTestReport> {
  const results: CryptoSmokeTestItem[] = [];

  const recordTest = (testName: string, passed: boolean, details?: string) => {
    results.push({ testName, passed, details });
  };

  try {
    if (!isWebCryptoAvailable()) {
      return {
        success: false,
        totalTests: 0,
        passedTests: 0,
        results: [{ testName: 'WebCrypto Availability', passed: false, details: 'Web Crypto API missing' }],
        error: 'Web Crypto API is not available.',
      };
    }

    // 1. Salt generation
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const saltDistinct = salt1.byteLength === 16 && salt1.some((byte, i) => byte !== salt2[i]);
    recordTest('Salt Generation (16 bytes & unique)', saltDistinct);

    // 2. Key derivation (use small iteration count 1000 strictly for fast smoke test execution)
    const testIterations = 1000;
    const passphraseA = 'SecureTestPIN-2026';
    const keyA1 = await deriveKeyFromPassphrase(passphraseA, salt1, testIterations);
    const keyA2 = await deriveKeyFromPassphrase(passphraseA, salt1, testIterations);
    const keyB = await deriveKeyFromPassphrase('DifferentPassphrase-999', salt1, testIterations);
    recordTest('Key Derivation from Passphrase', keyA1 instanceof CryptoKey && keyA1.algorithm.name === 'AES-GCM');

    // 3. Round-trip Encryption & Decryption (Basic English)
    const sampleText = 'Cycle tracker health note: Day 14 ovulation symptoms.';
    const envelope = await encryptData(sampleText, keyA1, { aad: 'periods' });
    const decryptedText = await decryptData(envelope, keyA1, { aad: 'periods' });
    recordTest('Round-Trip Encryption & Decryption (Basic)', decryptedText === sampleText);

    // 4. Deterministic Key Derivation Verification (key derived from same passphrase & salt decrypts)
    const decryptedWithA2 = await decryptData(envelope, keyA2, { aad: 'periods' });
    recordTest('Deterministic Key Derivation Round-Trip', decryptedWithA2 === sampleText);

    // 5. Wrong Key Rejection (Must Fail Closed)
    let wrongKeyFailed = false;
    try {
      await decryptData(envelope, keyB, { aad: 'periods' });
    } catch (err) {
      if (err instanceof CryptoError && err.code === 'AUTHENTICATION_FAILED') {
        wrongKeyFailed = true;
      }
    }
    recordTest('Wrong Key Authentication Failure', wrongKeyFailed);

    // 6. Wrong AAD Rejection (Must Fail Closed - Ciphertext swap prevention)
    let wrongAadFailed = false;
    try {
      await decryptData(envelope, keyA1, { aad: 'daily_logs' });
    } catch (err) {
      if (err instanceof CryptoError && err.code === 'AUTHENTICATION_FAILED') {
        wrongAadFailed = true;
      }
    }
    recordTest('Wrong AAD Authentication Failure (Ciphertext Swap Guard)', wrongAadFailed);

    // 7. Ciphertext Tampering Rejection (Single-byte modification must fail)
    const tamperedCiphertext = new Uint8Array(envelope.ciphertext.slice(0));
    tamperedCiphertext[0] ^= 0xff; // Flip first byte
    const tamperedEnvelope: CryptoEnvelope = {
      ...envelope,
      ciphertext: tamperedCiphertext.buffer,
    };
    let tamperingFailed = false;
    try {
      await decryptData(tamperedEnvelope, keyA1, { aad: 'periods' });
    } catch (err) {
      if (err instanceof CryptoError && err.code === 'AUTHENTICATION_FAILED') {
        tamperingFailed = true;
      }
    }
    recordTest('Tampered Ciphertext Authentication Failure', tamperingFailed);

    // 8. IV Uniqueness Test (Encrypt 50 times, verify all 50 IVs are distinct)
    const ivSet = new Set<string>();
    const count = 50;
    for (let i = 0; i < count; i++) {
      const env = await encryptData(sampleText, keyA1);
      const ivHex = Array.from(env.iv)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      ivSet.add(ivHex);
    }
    recordTest('IV Uniqueness (50 consecutive encryptions)', ivSet.size === count);

    // 9. Randomness / Non-Deterministic Ciphertext (Same plaintext produces different ciphertext)
    const enc1 = await encryptData('identical-string', keyA1);
    const enc2 = await encryptData('identical-string', keyA1);
    const enc1Bytes = new Uint8Array(enc1.ciphertext);
    const enc2Bytes = new Uint8Array(enc2.ciphertext);
    const ciphertextsDiffer = enc1Bytes.some((b, i) => b !== enc2Bytes[i]);
    recordTest('Non-Deterministic Ciphertext (Fresh IVs)', ciphertextsDiffer);

    // 10. Empty String Encryption & Decryption
    const emptyEnvelope = await encryptData('', keyA1);
    const emptyDecrypted = await decryptData(emptyEnvelope, keyA1);
    recordTest('Empty String Round-Trip', emptyDecrypted === '');

    // 11. Unicode, Accented, Non-Latin & Emoji Encryption & Decryption
    const unicodeText = 'Hello! Café ☕ こんにちは 世界 🌸 नमस्ते दुनिया 🩸 🔐';
    const unicodeEnvelope = await encryptData(unicodeText, keyA1, { aad: 'unicode_test' });
    const unicodeDecrypted = await decryptData(unicodeEnvelope, keyA1, { aad: 'unicode_test' });
    recordTest('Unicode, Multilingual & Emoji Round-Trip', unicodeDecrypted === unicodeText);

    // 12. Complex JSON Serialization & Round-Trip
    const complexJson = JSON.stringify({
      cycleDay: 14,
      phase: 'ovulation',
      symptoms: ['Cramps', 'Bloating'],
      meta: { nested: true, numbers: [1, 2, 3] },
    });
    const jsonEnvelope = await encryptData(complexJson, keyA1, { aad: 'json_test' });
    const jsonDecrypted = await decryptData(jsonEnvelope, keyA1, { aad: 'json_test' });
    recordTest('JSON Object Round-Trip', jsonDecrypted === complexJson);

    // 13. Moderately Large Payload Round-Trip (64 KB)
    const largePayload = 'A'.repeat(65536);
    const largeEnvelope = await encryptData(largePayload, keyA1, { aad: 'large_payload' });
    const largeDecrypted = await decryptData(largeEnvelope, keyA1, { aad: 'large_payload' });
    recordTest('Large Payload Round-Trip (64 KB)', largeDecrypted === largePayload);

    // 14. Unsupported Version Rejection
    const invalidVersionEnvelope: CryptoEnvelope = {
      ...envelope,
      cryptoVersion: 999,
    };
    let versionRejected = false;
    try {
      await decryptData(invalidVersionEnvelope, keyA1, { aad: 'periods' });
    } catch (err) {
      if (err instanceof CryptoError && err.code === 'UNSUPPORTED_CRYPTO_VERSION') {
        versionRejected = true;
      }
    }
    recordTest('Unsupported Crypto Version Rejection', versionRejected);

    // 15. Invalid IV Length Rejection
    const invalidIvEnvelope: CryptoEnvelope = {
      ...envelope,
      iv: new Uint8Array([1, 2, 3]), // 3 bytes instead of 12
    };
    let ivRejected = false;
    try {
      await decryptData(invalidIvEnvelope, keyA1, { aad: 'periods' });
    } catch (err) {
      if (err instanceof CryptoError && err.code === 'INVALID_IV') {
        ivRejected = true;
      }
    }
    recordTest('Invalid IV Length Rejection', ivRejected);

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
