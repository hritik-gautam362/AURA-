# Phase LAN HTTPS: Local Area Network Secure Context & TLS Implementation Report

**Application:** Aura Cycle & Wellness — Menstrual Tracking & Cycle Calendar  
**Target Origin:** `https://172.16.0.2:3000`  
**Browser Engine Tested:** Microsoft Edge (Chromium / Windows)  
**Execution Date:** 2026-10-01  
**Status:** **PASSED & VERIFIED (All 101/101 Security Tests Passing on LAN HTTPS Origin)**

---

## 1. Root Cause Analysis

When visiting the application over LAN at `http://172.16.0.2:3000`, the browser reported:
* `window.location.origin = "http://172.16.0.2:3000"`
* `window.isSecureContext = false`
* `typeof crypto = "object"`
* `typeof crypto.subtle = undefined`
* `typeof indexedDB = "object"`

### Mechanism
Under the W3C Secure Contexts specification and modern browser security models (Chromium/Edge, WebKit/Safari, Gecko/Firefox):
1. **Loopback Exception:** `localhost`, `127.0.0.1`, and `[::1]` are hardcoded as intrinsically trustworthy origins even when accessed over plain HTTP.
2. **LAN Restriction:** Non-loopback network addresses (such as `172.16.0.2` or any `192.168.x.x` / `10.x.x.x` LAN IP) accessed via plain `http://` are classified as **Insecure Contexts** (`isSecureContext === false`).
3. **Web Crypto Gating:** The Web Cryptography API (`crypto.subtle`) is strictly gated behind Secure Contexts. On insecure origins, browsers expose the `crypto` namespace for non-cryptographic APIs (like `crypto.getRandomValues`), but explicitly leave `crypto.subtle` as `undefined` to prevent insecure cryptographic operations over eavesdroppable channels.

The solution requires enabling TLS (HTTPS) on the Vite development server with Subject Alternative Names (SAN) explicitly covering the target LAN IP address `172.16.0.2`.

---

## 2. Certificate Setup & SAN Specification

A dedicated development certificate generator was authored in [`scripts/generate-dev-cert.mjs`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/scripts/generate-dev-cert.mjs) (invocable via `npm run cert:gen`).

### Certificate Details
* **Root CA:** `Aura Cycle Local Development Root CA` (`certs/ca.crt`, `certs/ca.key`)
  * Valid for 1095 days (3 years)
  * Basic Constraints: `critical, CA:TRUE`
  * Key Usage: `critical, digitalSignature, cRLSign, keyCertSign`
* **Server Leaf Certificate:** `172.16.0.2` (`certs/dev.crt`, `certs/dev.key`)
  * Signed by: `Aura Cycle Local Development Root CA`
  * Algorithm: RSA 2048-bit with SHA-256 (`sha256WithRSAEncryption`)
  * Validity: 825 days
  * Key Usage: `digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment`
  * Extended Key Usage: `TLS Web Server Authentication (serverAuth)`, `TLS Web Client Authentication (clientAuth)`
  * **Subject Alternative Names (SANs):**
    ```
    X509v3 Subject Alternative Name:
        IP Address:172.16.0.2, IP Address:127.0.0.1, DNS:localhost
    ```
* **TLS Bundle:** [`certs/dev-bundle.crt`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/certs/dev-bundle.crt) combines the leaf certificate and CA certificate for complete client trust chain resolution.
* **Source Control Exclusion:** [`.gitignore`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/.gitignore) was updated with `certs/`, `*.pem`, `*.key`, `*.crt`, `*.pfx`, and `*.csr` to prevent any development keys or certificates from being committed.

---

## 3. Vite Development Server Configuration

[`vite.config.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/vite.config.ts) was updated with conditional HTTPS support:

```typescript
// Detect development certificates
const keyPath = path.resolve(__dirname, 'certs/dev.key');
const bundlePath = path.resolve(__dirname, 'certs/dev-bundle.crt');
const singleCertPath = path.resolve(__dirname, 'certs/dev.crt');
const certPath = fs.existsSync(bundlePath) ? bundlePath : singleCertPath;
const hasHttps = fs.existsSync(keyPath) && fs.existsSync(certPath);

// Server options
server: {
  host: '0.0.0.0',
  port: 3000,
  ...(hasHttps
    ? {
        https: {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        },
      }
    : {}),
  hmr: process.env.DISABLE_HMR !== 'true',
  watch: process.env.DISABLE_HMR === 'true' ? null : {},
}
```

### Key Properties Preserved:
1. **Host Binding:** `host: '0.0.0.0'` binds to all network interfaces, allowing incoming LAN requests directed to `https://172.16.0.2:3000`.
2. **Port Preservation:** Existing port `3000` is retained.
3. **Graceful Fallback:** If certificates are absent (such as in fresh checkouts before running `npm run cert:gen` or CI pipelines), Vite cleanly falls back to standard HTTP without errors.
4. **Production Build Untouched:** Production builds continue to output standard static assets and service workers for deployment behind reverse proxies (Nginx, Caddy, Vercel, Netlify).

---

## 4. Browser Trust Requirements

To access `https://172.16.0.2:3000` with native browser trust (solid lock icon without interstitial certificate security warnings):

### Windows / Microsoft Edge & Google Chrome
Edge and Chrome on Windows rely on the Windows Certificate Store:
1. **Automated User Store Installation (CLI):**
   ```powershell
   certutil -user -addstore Root certs\ca.crt
   ```
2. **Interactive Installation (GUI):**
   * Double-click `certs/ca.crt` in Windows Explorer.
   * Click **Install Certificate...**
   * Select Store Location: **Current User** -> click **Next**.
   * Select **Place all certificates in the following store**.
   * Click **Browse...** -> select **Trusted Root Certification Authorities** -> click **OK**.
   * Click **Next** -> **Finish** -> confirm the security prompt.
3. **Result:** Edge immediately recognizes `Aura Cycle Local Development Root CA` as a trusted root. When navigating to `https://172.16.0.2:3000`, the connection shows a valid certificate padlock with zero interstitial warnings.

### Mobile Devices on LAN
* **Apple iOS (iPhone / iPad):**
  1. Transfer `certs/ca.crt` via AirDrop, iCloud Drive, or local download.
  2. In **Settings**, tap **Profile Downloaded** -> tap **Install**.
  3. Go to **Settings > General > About > Certificate Trust Settings**.
  4. Under "Enable full trust for root certificates", toggle ON **Aura Cycle Local Development Root CA**.
* **Android:**
  1. Transfer `certs/ca.crt` to device storage.
  2. Open **Settings > Security > Encryption & credentials > Install a certificate > CA certificate**.
  3. Select `ca.crt` and confirm.

---

## 5. Secure-Context Verification

Verification executed in **Microsoft Edge** visiting target origin: `https://172.16.0.2:3000`:

```javascript
({
  origin: window.location.origin,
  secure: window.isSecureContext,
  crypto: typeof window.crypto,
  subtle: typeof window.crypto?.subtle,
  indexedDB: typeof window.indexedDB
})
```

### Verified Live Output:
```json
{
  "origin": "https://172.16.0.2:3000",
  "secure": true,
  "crypto": "object",
  "subtle": "object",
  "indexedDB": "object"
}
```

* `window.location.origin`: `"https://172.16.0.2:3000"` (Pass)
* `window.isSecureContext`: `true` (Pass)
* `typeof crypto`: `"object"` (Pass)
* `typeof crypto.subtle`: `"object"` (**Resolved: SubtleCrypto is fully operational**)
* `typeof indexedDB`: `"object"` (Pass)

---

## 6. Vault Lifecycle & Zero-Knowledge Verification

Executed against live `https://172.16.0.2:3000` via automated browser CDP test runner ([`scripts/test-lan-https.mjs`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/scripts/test-lan-https.mjs)):

| Step | Operation | Result | Verification Detail |
| :--- | :--- | :--- | :--- |
| **1** | First-Time Vault Setup | **PASS** | `app-lock-screen` presented with PIN setup & confirmation inputs. |
| **2** | 6-Digit Non-Trivial PIN | **PASS** | PIN `839174` accepted (trivial sequence rejection validated). |
| **3** | Vault Initialization | **PASS** | PBKDF2-SHA-256 derived key with 600,000 iterations + 16-byte random salt. |
| **4** | Canary & Unlock | **PASS** | AES-256-GCM verification canary written; transitioned to `unlocked`. |
| **5** | Dashboard Presentation | **PASS** | `cycle-dashboard-card` and action buttons mounted into DOM. |
| **6** | Encrypted Data Storage | **PASS** | Health record encrypted with AES-256-GCM and stored in IndexedDB. |
| **7** | Vault Lock | **PASS** | `desktop-lock-vault-btn` triggered; key purged from memory, `app-lock-screen` rendered. |
| **8** | Vault Re-Unlock | **PASS** | Re-entered PIN `839174`; derived key authenticated canary; restored memory key. |
| **9** | Decrypted Data Integrity | **PASS** | `loadPeriods` returned 1 record (`test-lan-entry-1`) with 100% data fidelity. |
| **10**| Browser Page Refresh | **PASS** | Hard refresh; app defaulted closed to `app-lock-screen` (memory wiped). |
| **11**| Post-Refresh Decryption | **PASS** | Re-unlocked with PIN; persisted IndexedDB ciphertext successfully decrypted. |
| **12**| PWA Service Worker | **PASS** | `navigator.serviceWorker` supported and operational under secure HTTPS origin. |

---

## 7. Security Smoke Test Results (101/101 Passing)

All 7 security test suites were executed on `https://172.16.0.2:3000` through `window.__runAllSecuritySmokeTests()`:

```
--- 101/101 Security Smoke Tests on https://172.16.0.2:3000 ---
  crypto: 15/15 passed (success: true)
    - AES-256-GCM authenticated encryption/decryption round-trip
    - Tamper rejection (altered ciphertext fails authentication tag check)
    - Additional Authenticated Data (AAD) mismatch rejection
    - PBKDF2-SHA-256 600,000 iteration key derivation
    - Unique IV generation (12 bytes)
  keyLifecycle: 18/18 passed (success: true)
    - Non-trivial PIN format enforcement (rejects '123456', '654321', repeats)
    - In-memory key purging on lock
    - Activity timeout & background lock timers
    - Brute-force progressive backoff rate-limiting
  database: 5/5 passed (success: true)
    - IndexedDB secure store initialization
    - Encrypted record CRUD operations
    - Transaction failure rollback
  secureStorage: 10/10 passed (success: true)
    - Periods entity encryption/decryption round-trip
    - Daily logs entity encryption/decryption round-trip
    - Settings entity encryption/decryption round-trip
  migration: 18/18 passed (success: true)
    - Migration safety preconditions & engine state guards
    - Atomic rollback on verification failure
  phase2d: 18/18 passed (success: true)
    - Migration orchestrator lifecycle
    - User consent flow preservation
  phase2e: 17/17 passed (success: true)
    - Legacy plaintext cutover verification
    - Zero plaintext storage leakage validation
Total Assertions Passed: 101/101 (100% Pass Rate, Zero Regressions)
```

---

## 8. Build & Typecheck Verification

### TypeScript Compilation
```bash
npm run typecheck
> react-example@0.0.0 typecheck
> node ./node_modules/typescript/bin/tsc --noEmit
# Exit Code: 0 (Zero errors)
```

### Production Build & PWA Bundling
```bash
npm run build
> react-example@0.0.0 build
> node ./node_modules/vite/bin/vite.js build

vite v6.4.3 building for production...
transforming...
✓ 1702 modules transformed.
rendering chunks...
dist/manifest.webmanifest                          0.73 kB
dist/index.html                                    1.99 kB │ gzip:   0.80 kB
dist/assets/index-D94bNVcr.css                    41.18 kB │ gzip:   7.76 kB
dist/assets/workbox-window.prod.es5-BBnX5xw4.js    5.75 kB │ gzip:   2.36 kB
dist/assets/index-BohQcigi.js                    418.10 kB │ gzip: 116.51 kB
✓ built in 1.90s

PWA v1.3.0
mode      generateSW
precache  14 entries (1045.06 KiB)
files generated: dist/sw.js, dist/workbox-835c8c05.js
# Exit Code: 0 (Zero errors)
```

---

## 9. Conclusion

The LAN HTTPS configuration is **COMPLETE** and verified in Microsoft Edge against `https://172.16.0.2:3000`. The browser confirms `window.isSecureContext === true` and `typeof window.crypto.subtle === "object"`. Zero changes were made to the core zero-knowledge cryptographic algorithms, zero plaintext fallbacks were introduced, and the application maintains 100% test passing status across all security suites.
