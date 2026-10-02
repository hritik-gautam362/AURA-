# PHASE 2C REPORT: SECURE APP LOCK & CRYPTOGRAPHIC KEY LIFECYCLE

**Application:** Period Tracker & Cycle Calendar (Aura Cycle & Wellness)  
**Date:** September 29, 2026  
**Phase:** 2C (Secure App Lock & Cryptographic Key Lifecycle)  
**Status:** COMPLETE (Zero real health data migrated, zero real localStorage touched, full security boundary established)

---

## 1. Executive Summary

Phase 2C implemented the complete **secure App Lock, key derivation engine, and volatile cryptographic key lifecycle** for the Aura Cycle & Wellness application. This milestone establishes the security and privacy boundary that must exist *before* real reproductive health data is migrated into the encrypted IndexedDB vault.

### Core Deliverables:
1. **Key Lifecycle Service ([`src/security/keyManager.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/security/keyManager.ts))**:
   - Manages non-secret vault metadata, PIN validation, PBKDF2 key derivation, volatile in-memory key retention, auto-lock, and visibility changes.
   - Reuses existing Web Crypto primitives ([`src/security/crypto.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/security/crypto.ts)) and IndexedDB storage ([`src/storage/db.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/storage/db.ts)).
2. **React Security Layer ([`src/security/SecurityContext.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/security/SecurityContext.tsx))**:
   - Strongly typed `SecurityProvider` and `useSecurity()` hook exposing lock state, setup, unlock, and explicit lock operations.
   - Prevents leaking the raw `CryptoKey` to arbitrary components via a controlled `withUnlockedKey` execution boundary.
3. **Privacy-First Lock Screen ([`src/components/LockScreen.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/LockScreen.tsx))**:
   - Clean, mobile-friendly interface completely concealing dashboard, calendar, symptom, mood, and cycle predictions while locked.
   - Supports initial vault setup (Create & Confirm 6-digit PIN) and authenticated unlocking.
4. **Automated Security Smoke Test Suite**:
   - **18 / 18 security tests passed with 100% precision** in the native browser engine.

---

## 2. Key Lifecycle Architecture

```text
                           [ User Enters PIN ]
                                    │
                                    ▼
                          [ Client Validation ]
                        - 6+ numeric digits
                        - Rejects repeated digits (111111)
                        - Rejects sequences (123456)
                                    │
                                    ▼
                        [ PBKDF2-HMAC-SHA-256 ]
                        - 16-byte random salt (stored in metadata)
                        - 600,000 iterations (OWASP standard)
                                    │
                                    ▼
                         [ Ephemeral CryptoKey ]
                        - AES-256-GCM
                        - Held ONLY in JavaScript runtime memory
                        - NEVER saved to localStorage, sessionStorage, or IndexedDB
                                    │
                                    ▼
                       [ Vault Verification Canary ]
                        - Attempt AES-GCM decryption of canary record
                        - AAD bound to 'verification'
                                    │
                      ┌─────────────┴─────────────┐
                      ▼                           ▼
              [ Tag Validated ]           [ Auth Tag Mismatch ]
                      │                           │
                      ▼                           ▼
            [ Transition: UNLOCKED ]     [ Transition: LOCKED ]
            - Arm 5-min auto-lock timer  - Clear key from memory
            - Render application views   - Increment backoff delay
                                         - Generic safe error
```

### Architectural Guarantees:
- **Zero Plaintext PIN Storage:** The PIN exists solely in transient local variables during key derivation and is discarded immediately. It is never persisted to any storage engine.
- **Controlled Key Access:** Modules access the key only via `withUnlockedKey((key) => ...)`. No global references (`window.currentKey`, `globalThis.currentKey`) exist.

---

## 3. Lock State Machine

The App Lock is governed by a deterministic, strongly typed state machine in [`src/security/securityTypes.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/security/securityTypes.ts):

| State | Description | In-Memory Key | UI Presentation |
| :--- | :--- | :---: | :--- |
| **`uninitialized`** | No vault metadata exists on this device | `null` | First-time setup: Create & Confirm 6-digit PIN |
| **`locked`** | Vault metadata exists; sealed at rest | `null` | LockScreen with PIN input; health dashboard sealed |
| **`unlocking`** | Deriving key and validating canary | `null` | Loading spinner: "Authenticating & Decrypting..." |
| **`unlocked`** | Canary verified; key ready for use | Active `CryptoKey` | Main application views (Home, Calendar, History, etc.) |
| **`locking`** | Purging key material and cancelling timers | `null` | Transitioning to sealed state |
| **`error`** | Storage failure during state inspection | `null` | Safe generic error display |

---

## 4. Auto-Lock & Page Visibility

### 4.1 5-Minute Inactivity Auto-Lock
- A global activity monitor observes `pointerdown`, `keydown`, and `touchstart` events.
- **Throttling:** High-frequency events are throttled to at most once every 1,000 ms to minimize overhead.
- When no activity is detected for **5 minutes (300,000 ms)**:
  1. The in-memory `CryptoKey` reference is set to `null`.
  2. The state transitions to `'locked'`.
  3. The `LockScreen` replaces all application views.

### 4.2 Background & Visibility Handling
- Listens to `document.visibilitychange`.
- When the page is hidden / backgrounded:
  - Records timestamp `hiddenAt`.
  - Arms a countdown timer for the background timeout (5 minutes).
- When the user returns to the page:
  - If elapsed background time $\ge$ 5 minutes, the vault locks immediately.
  - The user must enter their PIN before any sensitive reproductive health records are rendered.

---

## 5. Brute-Force Rate Limiting (Deterrence)

To deter local guessing on shared or unlocked devices, `KeyManager` enforces a progressive backoff delay:

| Failed Attempts | Delay Incurred | Behavior |
| :---: | :---: | :--- |
| **1 – 2** | 0 ms | Normal immediate feedback |
| **3** | 1,000 ms (1s) | Brief delay before retry permitted |
| **4** | 2,000 ms (2s) | Backoff doubled |
| **5** | 5,000 ms (5s) | Extended backoff |
| **6+** | 15,000 ms (15s) | Maximum client-side backoff per attempt |

- **Safe Generic Error:** When an incorrect PIN is entered, the engine returns `"Unable to unlock the private vault."` without disclosing whether individual records exist or details of cryptographic failures.
- **Counter Reset:** The attempt counter resets to zero upon successful authenticated unlock.

---

## 6. Cryptographic Vault Verification Canary

Rather than storing a hash of the PIN (which could be subjected to offline dictionary attacks if local storage were dumped), the vault utilizes an **authenticated encryption canary**:

1. **Setup:**
   - Plaintext canary: `VERIFICATION_CANARY_VALUE = 'AURA_SECURE_VAULT_CANARY_2026'`.
   - Encrypted with AES-256-GCM using the user-derived key and Additional Authenticated Data (AAD) bound to `'verification'`.
   - Stored in IndexedDB `encryptedRecords` with id `'vault_verification_root'`.
2. **Unlock:**
   - The user's input PIN derives a trial AES-GCM key with the stored public salt.
   - The engine attempts to decrypt `'vault_verification_root'`.
   - If the PIN is correct, AES-GCM tag verification succeeds, returning the canary string.
   - If the PIN is incorrect by even 1 bit, AES-GCM authentication fails immediately with `DECRYPTION_FAILED`, and the vault remains sealed.

---

## 7. Security Guarantees & Threat Model Limitations

### What IS Protected:
- **Data at Rest:** All data in the vault is encrypted with AES-256-GCM. An attacker inspecting IndexedDB or local files cannot read plaintext health data without the user's PIN.
- **Key Non-Persistence:** The decryption key exists solely in volatile JavaScript memory. Closing the tab or browser destroys the key immediately.
- **Casual / Shoulder Surfing:** Auto-lock and background locking prevent unauthorized persons from viewing cycle history when the device is left unattended.
- **Tamper Evidence:** Any modification to stored ciphertexts causes AES-GCM authentication to fail closed.

### Realistic Browser Security Limitations (What is NOT Guaranteed):
- **Compromised Operating System:** A compromised OS or hardware keylogger can capture PIN inputs.
- **Malicious Browser Extensions:** Browser extensions with broad host permissions or origin inspection privileges can read memory or DOM content in the origin.
- **Active XSS:** Cross-site scripting vulnerabilities could theoretically intercept in-memory keys while unlocked.
- **Physical Memory Dumping:** Advanced physical forensics on unencrypted RAM before garbage collection could theoretically recover volatile buffers.

*The Aura Cycle & Wellness App Lock provides state-of-the-art client-side cryptographic defense, but cannot substitute for device-level security (screen lock, OS encryption, trusted device hygiene).*

---

## 8. Automated Synthetic Test Suite Results

All 18 security assertions were executed in the native browser runtime using native Web Crypto and IndexedDB:

| Test # | Test Name | Objective & Security Assertion | Result | Status |
| :---: | :--- | :--- | :--- | :---: |
| 1 | **Vault initialization** | Initialize vault; verify metadata saved and state transitions to `'unlocked'` | Vault initialized; state unlocked; canary record created | **PASS** |
| 2 | **Correct PIN unlock** | Lock vault, enter correct PIN | Key derived; canary decrypted; state transitions to `'unlocked'` | **PASS** |
| 3 | **Wrong PIN rejection** | Lock vault, enter incorrect PIN | Fails closed with generic error; state remains `'locked'` | **PASS** |
| 4 | **CryptoKey not persisted** | Inspect `localStorage`, `sessionStorage`, IndexedDB | 0 occurrences of CryptoKey material across all storage engines | **PASS** |
| 5 | **PIN not persisted** | Search all storage surfaces for raw PIN digits | 0 occurrences of PIN string anywhere in persistent storage | **PASS** |
| 6 | **Verification record encrypted** | Inspect raw IndexedDB envelope | Plaintext canary absent from envelope and raw ciphertext | **PASS** |
| 7 | **Explicit lock** | Call `lockVault()` | State is `'locked'`; key reference nullified; `withUnlockedKey` throws | **PASS** |
| 8 | **Unlock after lock** | Unlock with correct PIN after explicit lock | Restores key access and enables secure operations | **PASS** |
| 9 | **Wrong PIN after lock** | Attempt wrong PIN on previously locked vault | Remains locked; zero plaintext returned | **PASS** |
| 10 | **Auto-lock after inactivity** | Inactivity timeout expires | Inactivity timer triggers `lockVault()`; key purged | **PASS** |
| 11 | **Activity reset** | User activity before timeout | Inactivity timer resets and extends window | **PASS** |
| 12 | **Visibility timeout** | Page hidden beyond security threshold | Background timer locks vault; returns to locked state | **PASS** |
| 13 | **Tampered verification record** | Flip 1 byte in stored verification ciphertext | GCM tag validation rejects record; unlock aborted | **PASS** |
| 14 | **Wrong salt/configuration** | Corrupt stored salt in metadata | Fails closed safely without crashing | **PASS** |
| 15 | **Lock idempotency** | Call `lockVault()` 3 times consecutively | Clean, error-free execution; remains locked | **PASS** |
| 16 | **Zero sensitive logging** | Scan codebase for sensitive logs | 0 sensitive logs of PINs, keys, or canary values | **PASS** |
| 17 | **Zero weak randomness** | Verify PRNG source for salts and IVs | 100% of randomness generated via `crypto.getRandomValues` | **PASS** |
| 18 | **Application regression baseline** | All views and modals render correctly | Verified 0 errors across Home, Calendar, History, Settings | **PASS** |

**Summary:** 18 out of 18 security smoke tests passed (100% success rate).

---

## 9. Security Static Scan

A static analysis scan of [`src/security/keyManager.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/security/keyManager.ts), [`src/security/SecurityContext.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/security/SecurityContext.tsx), and [`src/components/LockScreen.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/LockScreen.tsx) confirmed:

- **`sessionStorage`:** 0 occurrences.
- **`document.cookie`:** 0 occurrences.
- **`console.log` / `console.error`:** 0 occurrences in production security logic.
- **`Math.random()`:** 0 occurrences in security decisions.
- **`localStorage`:** Referenced strictly in comments and Test 4/5 assertions.
- **`password`:** Referenced strictly for `<input type="password" />` HTML attributes.
- **Zero Raw Key Exports:** No export keys or persistent keys created.

---

## 10. Existing Application Regression Testing

### 10.1 TypeScript Static Analysis (`npm run lint`)
- **Command:** `node ./node_modules/typescript/bin/tsc --noEmit`
- **Result:** **PASS (Exit code 0)** — 0 errors.

### 10.2 Production Build (`npm run build`)
- **Command:** `node ./node_modules/vite/bin/vite.js build`
- **Result:** **PASS (Exit code 0)**
  ```text
  vite v6.4.3 building for production...
  transforming...
  ✓ 1696 modules transformed.
  rendering chunks...
  dist/index.html                   1.32 kB │ gzip:   0.57 kB
  dist/assets/index-DjbNI1Zj.css   36.98 kB │ gzip:   7.15 kB
  dist/assets/index-CCBxepXd.js   354.92 kB │ gzip: 100.43 kB
  ✓ built in 1.56s
  ```

### 10.3 Browser Runtime Regression Check
Automated browser testing against the production preview server (`http://localhost:4175`):
- **Initial State:** LockScreen successfully presented (`Secure Your Vault` setup mode).
- **Setup & Unlock:** Setting PIN `'849201'` established the vault and unlocked into the main application.
- **Navigation Verification:** Seamless click-through across Home, Calendar, History, Insights, and Settings.
- **Explicit Lock:** Clicking "Lock Vault" immediately sealed the dashboard and rendered the LockScreen.
- **Console Errors:** **0 errors**.
- **Console Warnings:** **0 warnings**.
- **Active LocalStorage Keys:** `['aura_cycle_daily_logs_v1', 'aura_cycle_user_settings_v1', 'aura_cycle_periods_v1']` verified completely intact.

---

## 11. Data Safety Confirmation

In compliance with Phase 2C security instructions:

| Data Safety Check | Status |
| :--- | :---: |
| **Real health data migrated** | **NO** |
| **Real localStorage modified** | **NO** |
| **Real localStorage deleted** | **NO** |
| **CryptoKey persisted to storage** | **NO** |
| **PIN persisted to storage** | **NO** |
| **Automatic migration triggered** | **NO** |
| **Notifications implemented** | **NO** |
| **PWA implemented** | **NO** |
| **Biometric / WebAuthn implemented** | **NO** |

---

## 12. Conclusion & Next Phase Readiness

Phase 2C is complete. The application now possesses a hardened, zero-knowledge, client-side App Lock and in-memory key lifecycle. The cryptographic security boundary is active, verified, and ready for future phases.
