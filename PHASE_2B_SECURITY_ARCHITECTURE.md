# PHASE 2B SECURITY ARCHITECTURE & DESIGN AUDIT

**Application:** Period Tracker & Cycle Calendar (Aura Cycle & Wellness)  
**Date:** September 27, 2026  
**Phase:** 2B-1 (Security & Secure Storage Architecture Design)  
**Status:** ARCHITECTURE DESIGN ONLY (No application code, storage, or dependencies modified)  
**Target:** Transition from unencrypted `window.localStorage` to an authenticated, encrypted, tamper-evident local vault backed by IndexedDB and Web Crypto API (AES-256-GCM).

---

## 1. Audit of Current Storage (`src/utils/storage.ts`)

The existing storage layer in [`src/utils/storage.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/utils/storage.ts) interacts exclusively with synchronous `window.localStorage` via three keys:

### 1.1 Stored Objects and Keys

| Entity | `localStorage` Key | Sensitivity | Current Format | Read Operations | Write Operations | Update / Delete Operations | Import / Export Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **User Settings & Profile** | `aura_cycle_user_settings_v1` | **Moderate** (User preferred name, cycle baseline, notification preferences, onboarding flag, profile ID) | Plaintext JSON string serialization of `UserSettings` | `loadSettings()` at app startup (`App.tsx` state initializer) and during `exportBackupJSON()` | `saveSettings(settings)` invoked via `useEffect` in `App.tsx` on every settings state update | Updated via `SettingsView.tsx` form submit and notification toggle handlers. Deleted via `clearAllData()` | Exported in JSON backup under root key `settings`. Imported via `importBackupJSON()` with fallback merge to `DEFAULT_SETTINGS` |
| **Menstrual Period Records** | `aura_cycle_periods_v1` | **Critical / Intimate Health** (Start/end dates, flow intensity `light/medium/heavy`, symptoms array, moods, free-form notes) | Plaintext JSON string serialization of `PeriodEntry[]` | `loadPeriods()` at app startup, during calculations (`cycleCalculations.ts`), and during export | `savePeriods(periods)` invoked via `useEffect` in `App.tsx` on every array state update | Appended or modified in `handleSavePeriod()`. Removed by `id` in `confirmDeletePeriod()`. Cleared via `clearAllData()` | Exported in JSON backup under root key `periods`. Imported via `importBackupJSON()` after checking `Array.isArray(data.periods)` |
| **Daily Health Check-ins** | `aura_cycle_daily_logs_v1` | **Critical / Intimate Health** (Daily bleeding flag, flow, physical symptoms, moods, energy ratings `low/normal/high`, intimate journal notes) | Plaintext JSON string serialization of `Record<string, DailyLog>` | `loadDailyLogs()` at startup, in `CalendarView.tsx`, `HomeDashboardView.tsx`, `InsightsView.tsx`, and export | `saveDailyLogs(logs)` invoked via `useEffect` in `App.tsx` on every daily log state update | Saved/updated by date key in `handleSaveDailyLog()`. Deleted by date key in `handleDeleteDailyLog()`. Cleared via `clearAllData()` | Exported in JSON backup under root key `dailyLogs`. Imported via `importBackupJSON()` after object validation |

### 1.2 Data Flow Nuances & Cross-Store Linkages
1. **Implicit Cross-Creation:** When a user logs a daily check-in in [`DailyLogModal.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/DailyLogModal.tsx) and marks `isPeriodDay: true`, `handleSaveDailyLog` in [`App.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/App.tsx) checks if any `PeriodEntry` covers that date. If not, it automatically synthesizes a single-day `PeriodEntry` (`id: period-daily-${Date.now()}`) and prepends it to `periods`.
2. **Reverse Linkage:** When a user logs a period via [`PeriodLogModal.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/PeriodLogModal.tsx) with flow or symptoms, `handleSavePeriod` in [`App.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/App.tsx) automatically synchronizes or creates a matching `DailyLog` record under `dailyLogs[entry.startDate]`.
3. **Storage Volatility & Blockage:** Synchronous `localStorage` blocks the main JavaScript thread during serialization of large multi-year logs. Furthermore, `localStorage` has a strict browser-enforced 5MB–10MB quota and lacks atomic multi-key transactions. If saving `periods` succeeds but saving `dailyLogs` fails due to quota or storage corruption, state inconsistency occurs.

---

## 2. IndexedDB Architecture

To eliminate blocking operations, support asynchronous transactional integrity, and handle large datasets with binary cryptographic payloads (ArrayBuffers/TypedArrays), we design a dedicated IndexedDB structure.

### 2.1 Database Overview
- **Database Name:** `aura_cycle_vault_db`
- **Database Version:** `1`
- **Driver Abstraction:** Lightweight native wrapper using Promises (zero external runtime dependencies, or optionally standard `idb` if approved in later phases).

### 2.2 Object Store Topology

We intentionally adopt a lean, structured 3-store topology to minimize schema overhead while enforcing separation between metadata, encrypted application data, and operational state:

```text
aura_cycle_vault_db (Version 1)
│
├── [store] metadata
│     Key: string (e.g. 'vault_meta', 'key_params', 'schema_version')
│     Value: { id: string, version: number, salt: Uint8Array, kdfParams: object, createdAt: string, updatedAt: string }
│
├── [store] encryptedRecords
│     Key: string (Entity ID or record partition key, e.g. 'periods', 'daily_logs', 'settings')
│     Indexes: 
│       - by_entity_type (keyPath: 'entityType')
│       - by_updated_at  (keyPath: 'updatedAt')
│     Value: {
│       id: string,                 // 'periods' | 'daily_logs' | 'settings' | or individual entity UUID
│       entityType: string,         // 'periods' | 'daily_logs' | 'settings'
│       recordVersion: number,      // schema version of the record
│       algorithm: 'AES-256-GCM',
│       keyVersion: number,         // version of the key used (for future key rotation)
│       iv: Uint8Array,             // 96-bit (12-byte) initialization vector
│       ciphertext: ArrayBuffer,    // encrypted payload with appended 128-bit authentication tag
│       updatedAt: string           // ISO timestamp for sync / conflict resolution
│     }
│
└── [store] appState
      Key: string (e.g. 'lock_state', 'migration_status', 'last_active')
      Value: { key: string, value: any, updatedAt: string }
```

### 2.3 Store Responsibilities & Indexing Strategy
1. **`metadata` Store:**
   - Holds non-sensitive vault parameters: KDF salt (PBKDF2/Argon2 params), key derivation iterations, cipher identifier, creation timestamps, and vault initialization state.
   - **Never stores raw keys, plaintext passwords, or unencrypted data.**
2. **`encryptedRecords` Store:**
   - Primary repository for all sensitive user health and profile data.
   - Stored in unified encrypted format. Each entry contains its own cryptographic IV and ciphertext.
   - Index `by_entity_type` allows targeted retrieval of specific subsets (e.g., retrieving only `periods` vs. `daily_logs` if records are partitioned).
   - Index `by_updated_at` supports differential backups and future synchronization logic.
3. **`appState` Store:**
   - Stores operational flags that must survive page reloads but are not health data: e.g., `migration_completed: true`, `app_lock_enabled: boolean`, `failed_passcode_attempts: number`.

### 2.4 Transaction Strategy & Upgrades
- **Read-Write Atomicity:** Whenever multiple related entities update simultaneously (e.g., creating a period and its corresponding daily log), a single `readwrite` transaction encompassing `encryptedRecords` is opened:
  ```ts
  const tx = db.transaction(['encryptedRecords'], 'readwrite');
  ```
  If any write fails (e.g., disk quota or validation error), the entire transaction aborts, preventing partial or inconsistent state.
- **Upgrade Handling (`onupgradeneeded`):**
  - Database schema evolution is handled through deterministic version checks (`oldVersion < 1`, `oldVersion < 2`).
  - No transactional schema alteration is allowed outside the `onupgradeneeded` callback.

---

## 3. Cryptography Design (Web Crypto API)

All encryption and decryption operations strictly use the native browser **Web Crypto API** (`window.crypto.subtle`). No custom ciphers or user-implemented cryptographic algorithms are permitted.

### 3.1 Algorithm Specification
- **Primary Cipher:** **AES-256-GCM** (`AES-GCM` with a 256-bit key).
- **Justification:** AES-GCM provides **Authenticated Encryption with Associated Data (AEAD)**. It guarantees both confidentiality (encryption) and data integrity/authenticity (tamper detection). Any unauthorized modification of the ciphertext or IV causes decryption to fail immediately.
- **Key Length:** 256 bits (`length: 256`).

### 3.2 Nonce / IV (Initialization Vector) Requirements
- **IV Length:** **96 bits (12 bytes)** — the NIST recommended and most secure IV length for AES-GCM.
- **Generation:** Cryptographically secure pseudo-random number generator:
  ```ts
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  ```
- **CRITICAL RULE:** **An IV must NEVER be reused with the same key.** Each encryption call generates a brand-new random 12-byte IV.
- **Collision Resistance:** A 96-bit random IV generated via `crypto.getRandomValues` provides collision-free safety well beyond the expected lifecycle write volume of a cycle tracker ($> 2^{32}$ operations).

### 3.3 Authentication Tag
- **Tag Length:** **128 bits (16 bytes)** (`tagLength: 128`).
- **Integration:** Handled automatically by the Web Crypto API, which appends the 16-byte authentication tag directly to the end of the ciphertext ArrayBuffer during `encrypt()`, and validates/strips it during `decrypt()`.

### 3.4 Additional Authenticated Data (AAD)
- To prevent ciphertext swap attacks (e.g., an attacker or corrupted script replacing the `periods` ciphertext with `daily_logs` ciphertext), each record binds its unique entity identifier as Additional Authenticated Data:
  ```ts
  const aad = new TextEncoder().encode(entityType); // e.g. "periods"
  const params: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv,
    additionalData: aad,
    tagLength: 128,
  };
  ```
- If an entity record is moved or swapped in the database, decryption will fail because the AAD mismatch causes authentication tag validation to reject the record.

### 3.5 Record Serialization & Envelope Format
The encrypted envelope stored in IndexedDB has the following canonical structure:

```ts
export interface EncryptedRecordEnvelope {
  id: string;               // Unique record ID (e.g. 'periods_root')
  entityType: string;       // 'periods' | 'daily_logs' | 'settings'
  recordVersion: number;    // Schema version (currently 1)
  algorithm: 'AES-256-GCM';
  keyVersion: number;       // Version of the key used (for future key rotation)
  iv: Uint8Array;           // 12-byte unique IV
  ciphertext: ArrayBuffer;  // Raw ciphertext + 16-byte GCM authentication tag
  updatedAt: string;        // ISO-8601 string
}
```

---

## 4. Key Management Architecture

Key management is the most critical and complex security layer in a client-side web application. Storing an encryption key in `localStorage` or hardcoding it in JavaScript completely voids encryption.

### 4.1 Evaluation of Key Storage Options

| Architecture Option | Description | Security Level | UX & Convenience | Browser Support | Verdict & Assessment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Option A: Non-Exportable CryptoKey in IndexedDB** | Browser generates a non-extractable (`extractable: false`) CryptoKey stored directly in IndexedDB. | **Low to Moderate** | **Seamless** (Zero user friction, automatic unlock) | High across all modern browsers | **Insufficient on its own for sensitive health data:** While scripts cannot extract the raw key bytes via JS, any script or local user with access to the browser origin can invoke `crypto.subtle.decrypt` using the stored key. Does not protect against device-level inspection or physical phone snooping. |
| **Option B: User-Derived Key (PIN / Passphrase + PBKDF2)** | User defines a PIN or passphrase. Key is derived on-demand in volatile memory via PBKDF2 using a high iteration count. | **High** | **Balanced** (User must enter PIN on app open or timeout) | 100% universal across all browsers | **Strongest security-to-friction ratio for intimate health apps.** Data remains fully encrypted at rest when locked. Closing the tab wipes the key from memory. If the device is stolen or unlocked, data cannot be decrypted without the PIN. |
| **Option C: WebAuthn / Passkey-Assisted Protection** | Uses hardware biometrics (TouchID, FaceID, Windows Hello) via WebAuthn Credential Creation and Assertion to guard access. | **Highest** | **High** (Quick biometric touch) | Good on mobile & modern desktop, but platform-dependent | **Ideal complementary enhancement**, but WebAuthn PRF (pseudo-random function) extension required to derive symmetric keys is not universally supported on all legacy mobile browsers. |
| **Option D: Multi-Tier Hybrid (Recommended Target)** | **Tier 1 (Device Vault):** Automatically generated non-exportable key encrypts local storage baseline. **Tier 2 (User Passcode / PIN):** User can enable App Lock, which wraps/derives the master key using a user-held PIN/passphrase. | **Highest Practical** | **Progressive** (Can function with transparent storage initially, prompting user to activate PIN Lock for maximum protection) | 100% universal compatibility | **Selected Architecture.** Provides immediate baseline protection and seamless UX, while allowing full zero-knowledge local encryption when the user sets a PIN. |

### 4.2 Key Derivation Details (PBKDF2)
- **KDF Algorithm:** **PBKDF2** with **HMAC-SHA-256** (`PBKDF2` / `SHA-256`).
- **Salt:** 16 cryptographically random bytes (`crypto.getRandomValues(new Uint8Array(16))`), generated on vault initialization and stored in `metadata.salt`.
- **Iteration Count:** **600,000 iterations** (OWASP recommended minimum for PBKDF2-HMAC-SHA256 as of 2026).
- **Key Derivation Flow:**
  ```text
  User PIN / Password
         │
         ▼
  TextEncoder (UTF-8)
         │
         ▼
  SubtleCrypto.importKey('raw', pinBytes, 'PBKDF2', false, ['deriveKey'])
         │
         ▼
  SubtleCrypto.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // Non-exportable!
    ['encrypt', 'decrypt']
  )
         │
         ▼
  Ephemeral Master CryptoKey (Held ONLY in Volatile Memory)
  ```

### 4.3 Key Lifecycle State Machine

```text
[ Vault Locked ]  <──────────────────────────────────────+
       │                                                 │
       │ (User enters correct PIN)                       │ (Timeout / Background / Manual Lock)
       ▼                                                 │
[ Key Derivation via PBKDF2 ]                            │
       │                                                 │
       ▼                                                 │
[ Vault Unlocked ]                                       │
       │                                                 │
       ├── CryptoKey exists in isolated module memory    │
       ├── Decrypts records on-demand                    │
       ├── Encrypts writes into IndexedDB                │
       │                                                 │
       ▼                                                 │
[ Lock Triggered ] ──────────────────────────────────────┘
       │
       ├── Set CryptoKey reference to null
       ├── Clear decrypted memory stores
       └── Notify UI state: 'LOCKED'
```

### 4.4 Lifecycle Operations Matrix
- **While Unlocked:** The `CryptoKey` reference exists exclusively in an isolated closure inside a dedicated `KeyManager` module. It is **never** attached to `window`, `document`, React component props, or accessible to DOM events.
- **While Locked:** The `CryptoKey` in memory is set to `null`. Only the salt and KDF iteration count remain stored on disk in the `metadata` store. Ciphertext in `encryptedRecords` cannot be decrypted.
- **On Page Refresh / Browser Restart:** Memory is cleared naturally by browser context termination. The app starts in `LOCKED` state and requires the user to input their PIN to derive the key again.
- **What If User Forgets Their PIN?**
  - **Zero-Knowledge Principle:** Because the key is derived directly from the PIN, **recovery without the PIN is cryptographically impossible.**
  - **Tradeoff Analysis:** Any backdoor or "reset password without PIN" mechanism requires escrowing the key or storing an unencrypted copy, which completely invalidates the security model.
  - **Graceful Handling:** The user will be given a clear disclaimer during PIN setup. If a PIN is permanently forgotten, the only recourse is a secure "Reset All Data" option, which purges the database and re-initializes an empty vault.

---

## 5. Critical Security Limitations & Defense in Depth

### 5.1 The Fundamental Client-Side Invariant
> [!IMPORTANT]
> **Client-side encryption does NOT make a web application immune to Cross-Site Scripting (XSS) or malicious browser extensions.**

If an attacker executes arbitrary JavaScript within the trusted origin while the vault is unlocked, that script has the exact same execution privileges as the application. The attacker can:
- Read decrypted data already loaded in React component memory.
- Hook into API calls or invoke the decryption routines using the active in-memory `CryptoKey`.
- Modify the DOM to exfiltrate keystrokes during PIN entry.

### 5.2 Defense-in-Depth Requirements
Because client-side encryption cannot prevent active origin compromise, the application must deploy comprehensive defensive controls:
1. **Strict Content Security Policy (CSP):** Zero tolerance for `unsafe-inline` scripts; zero untrusted external script domains.
2. **Subresource Integrity (SRI) & Zero External CDNs:** Self-host fonts and UI libraries to eliminate supply-chain injection vectors.
3. **Session Auto-Lock Inactivity Timer:** The vault must automatically lock after a configurable period of inactivity (e.g., 5 minutes) or when the browser window loses focus/visibility.
4. **Input Sanitization & Output Escaping:** Every user-provided string (notes, names) must be strictly treated as text, avoiding any raw HTML rendering (`dangerouslySetInnerHTML` is prohibited).
5. **Zero Telemetry / Zero Third-Party Trackers:** No third-party SDKs, analytics pixels, or external scripts.

---

## 6. LocalStorage Migration Design

Existing users currently have their data stored in plaintext in `localStorage`. The migration to encrypted IndexedDB must be **strictly safe, idempotent, non-destructive, and resilient to sudden browser termination**.

```text
[ Application Launch ]
         │
         ▼
[ Check Migration Status in IndexedDB appState ]
         │
    ┌────┴─────────────────────────────┐
    ▼                                  ▼
[ Already Migrated ]        [ Migration Needed ]
(Bypass migration)                     │
                                       ▼
                       [ Inspect & Validate localStorage ]
                       - aura_cycle_user_settings_v1
                       - aura_cycle_periods_v1
                       - aura_cycle_daily_logs_v1
                                       │
                                       ▼
                       [ Is localStorage Empty? ]
                        ├── YES: Mark migration completed -> Done
                        └── NO:  Continue
                                       │
                                       ▼
                       [ Ensure Key Availability ]
                       (Device key or User PIN unlocked)
                                       │
                                       ▼
                       [ Encrypt Validated Data ]
                       - Encrypt settings
                       - Encrypt periods
                       - Encrypt dailyLogs
                                       │
                                       ▼
                       [ Open IndexedDB readwrite Transaction ]
                       - Write encryptedRecords
                       - Write migration_status: 'in_progress'
                                       │
                                       ▼
                       [ Verify Written Records in IndexedDB ]
                       (Perform test read & authentication check)
                                       │
                          ┌────────────┴─────────────┐
                          ▼                          ▼
                  [ Check PASSED ]            [ Check FAILED ]
                          │                          │
                          ▼                          ▼
            [ Remove localStorage Keys ]     [ Abort Transaction ]
            - Remove aura_cycle_*            - Keep localStorage intact
            - Mark status: 'completed'       - Log error safely
                          │                          │
                          ▼                          ▼
                  [ Migration Success ]      [ Retry on next launch ]
```

### 6.1 Step-by-Step Migration Protocol
1. **Detection:** Check `appState` store in IndexedDB for `migration_completed: true`. If true, exit immediately.
2. **Validation:** Read raw strings from `localStorage`. Parse JSON with strict schema validation. If JSON is partially malformed, salvage valid records into sanitization structures rather than throwing unhandled exceptions.
3. **Encryption:** Encrypt each dataset (`settings`, `periods`, `dailyLogs`) into an `EncryptedRecordEnvelope` using fresh random IVs.
4. **Transactional Commit:** Open a single `readwrite` transaction to IndexedDB. Put the envelopes into `encryptedRecords`.
5. **Verification (Smoke Decryption):** Before touching `localStorage`, read the newly written records back from IndexedDB and test-decrypt them in memory.
6. **Safe Deletion:** Only after verification passes, purge the old plaintext keys (`aura_cycle_user_settings_v1`, `aura_cycle_periods_v1`, `aura_cycle_daily_logs_v1`) from `localStorage`. Set `migration_completed: true` in `appState`.
7. **Idempotency Guarantee:** If the browser crashes, loses power, or closes at any microsecond during steps 1 through 5, `localStorage` remains 100% intact. On next boot, the process restarts cleanly without data loss.

---

## 7. Data Versioning & Cryptographic Agility

To ensure the application can upgrade cryptographic parameters in the future (e.g., transitioning from AES-256-GCM to post-quantum algorithms, or rotating keys), all stored entities must include explicit envelope metadata.

### 7.1 Canonical Record Header
```ts
export interface VaultEnvelope<T = any> {
  // Envelope metadata
  schemaVersion: 1;              // Data structure schema version
  cryptoVersion: 1;              // Cryptographic envelope version
  algorithm: 'AES-256-GCM';      // Cipher algorithm
  keyVersion: number;            // Monotonic key version for rotation
  
  // Cryptographic payload
  iv: string;                    // Base64-encoded 12-byte IV
  ciphertext: string;            // Base64-encoded ciphertext + 16-byte tag
  
  // Non-sensitive indexing attributes
  recordId: string;              // Entity partition key
  entityType: 'periods' | 'daily_logs' | 'settings';
  createdAt: string;             // ISO-8601
  updatedAt: string;             // ISO-8601
}
```

### 7.2 Future Key Rotation Protocol
When key rotation is initiated (e.g., user changes their PIN):
1. Derive new key $K_2$ with fresh salt.
2. Read all envelopes encrypted with $K_1$.
3. Decrypt with $K_1$, then immediately re-encrypt with $K_2$ and brand-new random IVs, setting `keyVersion: 2`.
4. Commit in a single atomic transaction.
5. Destroy $K_1$ and update salt in `metadata`.

---

## 8. Export and Import Architecture

The existing application provides plaintext JSON export and import. In an encrypted paradigm, data export must be handled with heightened privacy controls.

### 8.1 Dual Export Modality

```text
                                [ User Requests Export ]
                                           │
                                           ▼
                             [ Vault Must Be Unlocked ]
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
             [ Option 1: Encrypted Backup ]       [ Option 2: Plaintext JSON ]
             - Protected by user password         - Portable & human-readable
             - Encrypted via AES-256-GCM          - Prompts clear privacy warning
             - Safe for cloud/email storage       - Risk of local file theft
                        │                                     │
                        ▼                                     ▼
             [ Generate .auravault file ]         [ Generate .json file ]
```

### 8.2 Encrypted Export Specification (`.auravault`)
- **Format:** Versioned JSON container holding salt, PBKDF2 iterations, unique export IV, and AES-256-GCM encrypted payload.
- **Workflow:**
  1. Prompt user for an export passphrase (can be distinct from their daily PIN).
  2. Derive export key via PBKDF2-SHA-256 (600,000 iterations).
  3. Encrypt the entire decrypted health dataset.
  4. Output a file with extension `.auravault`.
  5. The file can be safely stored on cloud drives or emailed without risking health privacy.

### 8.3 Plaintext Export Safeguards (`.json`)
- If the user explicitly selects unencrypted export:
  1. Display a prominent security confirmation modal: *"Warning: Exporting unencrypted data will save all cycle and intimate health notes in readable text on this device."*
  2. The exported JSON follows the existing backup schema for backward compatibility.

---

## 9. Backup & Restore Validation (Untrusted Input)

Any imported file (whether `.auravault` or `.json`) must be treated as **potentially malicious or corrupted untrusted input**.

### 9.1 Ingestion Security Checklist
1. **Size Limit Enforcement:** Reject any backup file exceeding **10MB** before parsing to prevent Memory Exhaustion / Denial of Service.
2. **Strict JSON Parsing:** Execute inside a `try/catch` wrapper; validate root keys.
3. **Type and Schema Validation:** Validate every period and daily log record:
   - Dates must match strict regex `^\d{4}-\d{2}-\d{2}$` and represent mathematically valid calendar dates.
   - `flow` must be one of `'light' | 'medium' | 'heavy'`.
   - `symptoms` must be an array of strings capped at 50 items, with each string length $\le 100$ characters.
   - `notes` string length must be $\le 5,000$ characters to prevent memory bloating.
4. **Sanitization:** Strip any unexpected fields or prototype pollution attempts (`__proto__`, `constructor`).
5. **Dry-Run Validation:** Validate the entire dataset in memory first. If any record fails validation, abort the restore and display a descriptive error without modifying existing stored data.

---

## 10. Memory Security & Inactivity Locking

While JavaScript runs in a managed runtime without direct manual memory deallocation (`memset`/`ZeroMemory`), application architecture can still enforce rigorous memory hygiene.

### 10.1 Memory Management Rules
1. **Zero Global Scope Exposure:** Decrypted health records must never be assigned to `window`, global variables, or module-level `let` variables.
2. **Ephemeral React State:** Data is kept in React state only while the vault is in the `UNLOCKED` state.
3. **Lock Purge Routine:**
   - When the vault locks:
     ```ts
     // Nullify active key reference
     activeCryptoKey = null;
     // Clear React states in App.tsx
     setPeriods([]);
     setDailyLogs({});
     setSettings(LOCKED_PLACEHOLDER_SETTINGS);
     ```
   - Garbage collection will reclaim the discarded strings and ArrayBuffers.
4. **Inactivity Auto-Lock:**
   - A global activity listener monitors user interaction (`pointerdown`, `keydown`).
   - If no interaction occurs within **5 minutes** (configurable), the vault locks automatically.
5. **Background / Tab Visibility Lock:**
   - When the user switches tabs or minimizes the browser, `document.visibilityState === 'hidden'` triggers an inactivity countdown. If the tab remains hidden for $> 60$ seconds, it transitions to `LOCKED`.

---

## 11. Multi-Tab Synchronization & Concurrency

Users frequently open multiple tabs of the same application. Without cross-tab coordination, concurrent writes or mismatched lock states lead to data corruption or race conditions.

### 11.1 Synchronization via `BroadcastChannel`
- **Channel Name:** `aura_vault_sync_channel`
- **Message Types:**
  - `VAULT_LOCKED`: When one tab locks, all other open tabs immediately clear memory and lock their UI.
  - `VAULT_UNLOCKED`: (Optional) Can notify sibling tabs to prompt for unlock or synchronize state.
  - `RECORD_UPDATED`: Notifies sibling tabs that a record was updated in IndexedDB, triggering a background refresh without requiring page reloads.

### 11.2 Concurrency Control
- All writes to IndexedDB are wrapped in transactions.
- In the event of simultaneous writes from two tabs, IndexedDB transaction queues serialize the updates, preventing database corruption.

---

## 12. Storage Failure & Resilience (Fail-Closed Architecture)

```text
                          [ Storage Error Occurs ]
                          (Quota, Corruption, Incognito)
                                     │
                                     ▼
                           [ FAIL-CLOSED GATE ]
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
[ STRICTLY PROHIBITED ]                             [ REQUIRED ACTION ]
Silent fallback to plaintext                       Display clear diagnostic error.
localStorage or cookies.                           Retain encrypted integrity.
                                                   Prevent insecure writes.
```

### 12.1 Specific Failure Handling
1. **Private Browsing / Incognito Mode Restrictions:** Some browsers restrict or provide ephemeral IndexedDB. If IndexedDB initialization fails, show a friendly warning: *"Private browsing storage restriction detected. Changes cannot be saved securely to this device."*
2. **Quota Exceeded:** Catch `QuotaExceededError`. Display storage warning and offer data export before aborting write operations.
3. **Decryption Authentication Failure:** If `crypto.subtle.decrypt()` fails, it indicates an incorrect PIN or tampered/corrupted ciphertext. Display: *"Incorrect PIN or damaged record."*
4. **NO Silent Fallback:** Under no circumstances will the system silently downgrade to plaintext `localStorage`. The security posture must remain **Fail-Closed**.

---

## 13. Content Security Policy (CSP) & XSS Compatibility

To enforce defense-in-depth, the codebase must be fully compatible with a strict Content Security Policy.

### 13.1 CSP Compatibility Audit of Existing Codebase
- **Inline Scripts:** The existing application has zero inline `<script>` tags in `index.html`. All logic loads via `<script type="module" src="/src/main.tsx"></script>`.
- **Inline Styles:** Tailwind v4 generates atomic classes; no inline `<style>` blocks are required. However, Google Fonts is currently fetched via external CDN (`fonts.googleapis.com` and `fonts.gstatic.com`).
- **Target CSP Header:**
  ```http
  Content-Security-Policy: 
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data:;
    connect-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  ```
- *Note:* In Phase 12 (Production Hardening), fonts will be bundled locally to eliminate even the Google Fonts external connection (`font-src 'self'`).

---

## 14. Performance & Mobile Responsiveness

Cryptographic operations and asynchronous database calls must not degrade UI fluidness, especially on low-powered mobile devices.

### 14.1 Performance Analysis & Benchmarks
1. **AES-256-GCM Throughput:**
   - Web Crypto API is implemented in native C++/Rust within browser engines (Blink, WebKit, Gecko).
   - Encrypting/decrypting a typical period tracker dataset ($\approx 50\text{KB}$ to $500\text{KB}$) takes **$< 2$ milliseconds** on modern mobile hardware.
2. **PBKDF2 Overhead (600,000 Iterations):**
   - Deriving the key on PIN submission takes approximately **$120\text{ms} - 350\text{ms}$** on mobile processors.
   - This occurs **only once** upon unlocking, serving as an acceptable, imperceptible delay that doubles as a natural brute-force deterrent.
3. **IndexedDB Read Latency:**
   - Reading the partitioned envelopes on startup takes **$< 15\text{ms}$**.
   - Entire startup and decryption cycle completes within **$< 400\text{ms}$**, well below the 1-second threshold for perceptible delay.

---

## 15. Comprehensive Threat Model Evaluation

| Threat # | Scenario | Protection Mechanism | Limitations | Residual Risk |
| :--- | :--- | :--- | :--- | :--- |
| **T-01** | Someone picks up user's unlocked phone and opens the browser. | Inactivity auto-lock + App Lock PIN barrier. | User must enable App Lock and not leave screen active with vault unlocked. | Low (if App Lock enabled); High (if user leaves vault actively unlocked). |
| **T-02** | Someone inspects browser Developer Tools (F12) or browser profile. | All health data in IndexedDB is AES-256-GCM encrypted. | Metadata stores KDF salt and iteration count (non-secret). | Low. Raw database inspection yields only encrypted ciphertext. |
| **T-03** | Local disk forensics / device extraction. | AES-256-GCM encryption with 600,000 PBKDF2 iterations. | Brute-force risk if user selects an overly simple 4-digit PIN (e.g. 1234). | Low to Moderate. Mitigated by enforcing minimum PIN length / complexity. |
| **T-04** | Plaintext `localStorage` leakage. | All sensitive data migrated out of `localStorage`. Old keys purged. | Transient migration window. | Negligible once migration completes. |
| **T-05** | Malicious XSS executes while vault is unlocked. | Strict CSP, no third-party scripts, auto-lock timeout. | If XSS executes while vault is unlocked, attacker can access in-memory data. | Medium. Client-side encryption cannot prevent authenticated runtime memory snooping. |
| **T-06** | Malicious browser extension inspects origin context. | Content isolation, no global key exposure. | Highly privileged extensions with `<all_urls>` can read DOM or inject scripts. | Medium. Browser security model grants extensions high origin authority. |
| **T-07** | Backup / export file is stolen from user's laptop or cloud drive. | Password-protected `.auravault` encrypted backup format. | User must choose a strong passphrase for export. | Low if encrypted export is chosen; High if plaintext export is chosen. |
| **T-08** | Backup file is maliciously modified before restore. | AES-256-GCM authentication tag verification on restore. | If restored file is modified, tag check fails and import aborts. | Negligible. Tampered backups cannot be decrypted or imported. |
| **T-09** | Browser storage corruption or partial write crash. | Atomic IndexedDB transactions + idempotent migration verification. | Hardware disk failure could render database unreadable. | Low. User is encouraged to create periodic `.auravault` backups. |
| **T-10** | User permanently forgets their unlock PIN. | Clear disclaimer during setup; secure "Erase All Data & Reset" option. | Data cannot be recovered without PIN (Zero-Knowledge). | Data loss for the user, but zero privacy compromise. |

---

## 16. Target Architecture Specification

### 16.1 Target Component Architecture

```text
+------------------------------------------------------------------------------------+
|                                    PRESENTATION LAYER                              |
|                                                                                    |
|  +--------------------+        +---------------------+      +-------------------+  |
|  |   App Lock Modal   | -----> | React UI Components | <--> | Synchronization   |  |
|  |  (PIN Entry / Setup|        | (Views, Modals, Nav)|      | (BroadcastChannel)|  |
|  +--------------------+        +----------+----------+      +-------------------+  |
+-------------------------------------------|----------------------------------------+
                                            |
                                            v
+------------------------------------------------------------------------------------+
|                                  STATE & SERVICE LAYER                             |
|                                                                                    |
|                        +------------------------------------+                      |
|                        |       Secure Storage Service       |                      |
|                        | (getPeriods, saveDailyLogs, etc.)  |                      |
|                        +------------------+-----------------+                      |
|                                           |                                        |
|                         ┌─────────────────┴─────────────────┐                      |
|                         ▼                                   ▼                      |
|             +-----------------------+           +-----------------------+          |
|             |      Crypto Engine    |           |      Key Manager      |          |
|             |  (AES-GCM 256 + IV)   | <-------> |  (PBKDF2, In-Memory   |          |
|             |   Web Crypto Subtle   |           |   Active Key Closure) |          |
|             +-----------+-----------+           +-----------------------+          |
+-------------------------|----------------------------------------------------------+
                          |
                          v
+------------------------------------------------------------------------------------+
|                                 PERSISTENCE LAYER                                  |
|                                                                                    |
|                        +------------------------------------+                      |
|                        |       IndexedDB Storage Engine     |                      |
|                        | (aura_cycle_vault_db v1: metadata, |                      |
|                        |  encryptedRecords, appState)       |                      |
|                        +------------------------------------+                      |
+------------------------------------------------------------------------------------+
```

### 16.2 Module Responsibilities & Core Interfaces

#### A. Key Manager (`src/security/keyManager.ts`)
```ts
export interface KeyManager {
  isVaultInitialized(): Promise<boolean>;
  isVaultUnlocked(): boolean;
  initializeVault(pin: string): Promise<void>;
  unlockVault(pin: string): Promise<boolean>;
  lockVault(): void;
  getActiveKey(): CryptoKey | null; // Available only to internal crypto modules
  changePin(oldPin: string, newPin: string): Promise<boolean>;
  resetVault(): Promise<void>;
}
```

#### B. Crypto Engine (`src/security/cryptoEngine.ts`)
```ts
export interface CryptoEngine {
  encryptData<T>(data: T, entityType: string, key: CryptoKey): Promise<EncryptedRecordEnvelope>;
  decryptData<T>(envelope: EncryptedRecordEnvelope, key: CryptoKey): Promise<T>;
  encryptBackup(data: any, passphrase: string): Promise<string>;
  decryptBackup(cipherJson: string, passphrase: string): Promise<any>;
}
```

#### C. Secure Storage Service (`src/storage/secureStorage.ts`)
```ts
export interface SecureStorageService {
  loadUserSettings(): Promise<UserSettings>;
  saveUserSettings(settings: UserSettings): Promise<void>;
  loadPeriods(): Promise<PeriodEntry[]>;
  savePeriods(periods: PeriodEntry[]): Promise<void>;
  loadDailyLogs(): Promise<Record<string, DailyLog>>;
  saveDailyLogs(logs: Record<string, DailyLog>): Promise<void>;
  clearAllSecureData(): Promise<void>;
  migrateFromLocalStorage(): Promise<boolean>;
}
```

---

## 17. Proposed File Structure for Future Implementation

When we proceed to implementation phases, the security architecture will be structured cleanly into modular subdirectories under `src/`:

```text
src/
├── security/                      # Cryptographic & Vault Access Modules
│   ├── securityTypes.ts           # Envelopes, cipher parameters, key status types
│   ├── cryptoEngine.ts            # Web Crypto AES-256-GCM encrypt/decrypt primitives
│   ├── keyManager.ts              # PBKDF2 derivation, in-memory key state, lock timer
│   └── syncChannel.ts             # BroadcastChannel cross-tab lock & update coordination
│
├── storage/                       # Storage Abstraction & IndexedDB Implementation
│   ├── db.ts                      # IndexedDB low-level database connection & schema
│   ├── secureStorage.ts           # Asynchronous high-level storage service interface
│   ├── migrations.ts              # LocalStorage -> IndexedDB idempotent migration
│   └── exportImport.ts            # Validated backup import/export (.auravault & .json)
│
├── components/
│   ├── AppLockModal.tsx           # PIN setup, unlock screen, timeout unlock prompts
│   └── ... (existing views)
```

---

## 18. Phased Implementation Roadmap

The implementation of the security architecture must be split into incremental, individually testable steps:

### Phase 2B-2: IndexedDB Layer Foundation
- **Objective:** Implement low-level native IndexedDB schema (`db.ts`) with stores `metadata`, `encryptedRecords`, and `appState`.
- **Files Changed:** `src/storage/db.ts`, `src/storage/storageTypes.ts`.
- **Migration Risk:** None (no user data touched yet).
- **Tests Required:** Database creation, version upgrade events, transactional read/write of raw records.
- **Rollback Strategy:** Delete `src/storage/db.ts`.

### Phase 2B-3: Web Crypto Primitives
- **Objective:** Implement `cryptoEngine.ts` (AES-256-GCM encryption/decryption with 96-bit unique IVs, 128-bit tags, and AAD).
- **Files Changed:** `src/security/cryptoEngine.ts`, `src/security/securityTypes.ts`.
- **Migration Risk:** None.
- **Tests Required:** Test encryption round-trips, tamper-detection (modified ciphertext must throw), IV uniqueness verification.
- **Rollback Strategy:** Delete module.

### Phase 2B-4: Key Management & In-Memory Vault State
- **Objective:** Implement `keyManager.ts` with PBKDF2-SHA-256 derivation (600,000 iterations), salt generation, and in-memory key closure.
- **Files Changed:** `src/security/keyManager.ts`.
- **Migration Risk:** None.
- **Tests Required:** Key derivation consistency, correct PIN acceptance, wrong PIN rejection, memory lock cleanup.
- **Rollback Strategy:** Delete module.

### Phase 2B-5: Secure Storage Service Integration
- **Objective:** Wire `secureStorage.ts` to bridge `cryptoEngine` and `db.ts`, implementing asynchronous equivalents of storage functions.
- **Files Changed:** `src/storage/secureStorage.ts`.
- **Migration Risk:** None (side-by-side implementation).
- **Tests Required:** Full asynchronous save and load cycle with automatic encryption.
- **Rollback Strategy:** Delete module.

### Phase 2B-6: LocalStorage Migration Engine
- **Objective:** Implement `migrations.ts` to safely read, validate, encrypt, verify, and purge plaintext `localStorage` records.
- **Files Changed:** `src/storage/migrations.ts`.
- **Migration Risk:** High. Requires fail-closed verification before purging `localStorage`.
- **Tests Required:** Simulated migration with demo data, malformed data handling, crash simulation (verify `localStorage` remains intact if write fails).
- **Rollback Strategy:** Inverted flag in `appState` leaves `localStorage` intact.

### Phase 2B-7: App Lock UI & Multi-Tab Synchronization
- **Objective:** Add `AppLockModal.tsx`, inactivity timer hook, and `BroadcastChannel` cross-tab lock sync.
- **Files Changed:** `src/components/AppLockModal.tsx`, `src/security/syncChannel.ts`, `src/App.tsx`.
- **Migration Risk:** Low.
- **Tests Required:** Inactivity auto-lock triggering, multi-tab lock synchronization, PIN reset flow.
- **Rollback Strategy:** Disable App Lock toggle.

### Phase 2B-8: Export / Import Hardening & Security Testing
- **Objective:** Implement `.auravault` encrypted backup export/import and strict schema validation for `.json` files.
- **Files Changed:** `src/storage/exportImport.ts`, `src/components/SettingsView.tsx`.
- **Migration Risk:** Low.
- **Tests Required:** Import/export round-trip, tampered file rejection, oversized file rejection.
- **Rollback Strategy:** Revert to previous backup export helper.

---

## 19. Recommended Next Step: Phase 2B-2

For **Phase 2B-2**, we should implement the low-level IndexedDB abstraction without touching application code or migrating user data yet:
1. Create `src/storage/storageTypes.ts` defining store schemas and database interfaces.
2. Create `src/storage/db.ts` implementing connection management, schema initialization, and transactional helpers for `aura_cycle_vault_db`.
3. Verify that the build (`npm run build`) and type check (`npm run lint`) remain completely clean.

---
*End of Phase 2B Security Architecture Document.*
