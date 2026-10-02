# Phase 3B: Private Period Reminders & Notifications Report

**Application:** Aura Cycle & Wellness — Menstrual Tracking & Cycle Calendar  
**Phase Completed:** Phase 3B (Private Period Reminders & Notifications)  
**Execution Date:** 2026-10-01  
**Target Environment Tested:** Microsoft Edge (Chromium / Windows) on `https://172.16.0.2:3000`  
**Status:** **PASSED & VERIFIED (All 16/16 Phase 3B Tests + 101/101 Security Tests Passing)**

---

## 1. Executive Summary

Phase 3B introduces privacy-safe period reminders and notification management to Aura Cycle & Wellness without compromising the application's zero-knowledge security architecture. 

**Core Principles Maintained:**
- **Zero Plaintext Storage:** Notification preferences and duplicate-prevention hashes are stored strictly inside the existing encrypted IndexedDB settings vault (`settings_root`) using authenticated AES-256-GCM.
- **Zero Sensitive Data in Notifications:** Notification titles and bodies contain **zero** health information, cycle phases, symptoms, moods, or calendar dates.
- **No Third-Party Services or Servers:** No push servers, no Firebase, no cloud backends, no user accounts, and no analytics were introduced.
- **Fail-Closed Privacy:** In locked state, volatile keys remain zeroed and health data is not decrypted merely to display an alert.

---

## 2. Notification Architecture

The notification system is structured into five modular components:

```
┌─────────────────────────────────────────────────────────────┐
│                      Aura Cycle UI                          │
│                                                             │
│   SettingsView                 AppContent (App.tsx)         │
│  [Privacy & Notifications]    [App Open & Resume Listener]  │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│         Notification Utility (src/utils/notifications.ts)   │
│                                                             │
│  - evaluatePeriodReminder(calcResult, settings)             │
│  - computeReminderHash(targetDate, type) [SHA-256]          │
│  - sendPrivacySafeNotification(options)                     │
│  - requestNotificationPermission()                          │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│   Encrypted IndexedDB Vault  │ │   Browser Web Notification │
│   (AES-256-GCM Settings)     │ │   & ServiceWorker API      │
└──────────────────────────────┘ └────────────────────────────┘
```

1. **Settings Model ([`src/types.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/types.ts)):**
   - Added `NotificationReminderMode`: `'off' | 'silent' | 'sound'`.
   - Added `ReminderTimingOption`: `'same_day' | '1_day_before' | '2_days_before' | '3_days_before'`.
   - Extended `UserNotificationSettings` with `periodReminderMode`, `reminderTiming`, `lastDeliveredReminderHash`, and `lastDeliveredAt`.
   - Preserved full backward compatibility with legacy boolean notification flags.
2. **Notification Utility ([`src/utils/notifications.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/utils/notifications.ts)):**
   - `isNotificationSupported()`: Safely detects Web Notification API.
   - `getNotificationPermission()`: Evaluates permission status (`'granted'`, `'denied'`, `'default'`, `'unsupported'`).
   - `requestNotificationPermission()`: Triggers permission request only upon explicit user action; avoids re-prompting once denied.
   - `computeReminderHash()`: Generates deterministic SHA-256 digest of target date and reminder type.
   - `evaluatePeriodReminder()`: Ingests existing `CycleCalculationResult` and settings to verify timing thresholds and duplicate delivery.
   - `sendPrivacySafeNotification()`: Uses `ServiceWorkerRegistration.showNotification()` or standard `Notification` constructor with strict privacy strings.
3. **Settings Interface ([`src/components/SettingsView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/SettingsView.tsx)):**
   - Added clean "Privacy & Notifications" section conforming to Aura design aesthetics.
   - Mode selectors: `Off`, `Silent`, `On + Sound`.
   - Timing selector: `1 day before` (with extensible underlying engine).
   - Permission status indicator badge.
   - "Test Notification" trigger (only available when permission is granted).
   - Documented browser sound and background limitations.
4. **App Open & Resume Evaluator ([`src/App.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/App.tsx)):**
   - Automatically checks reminder criteria whenever the application is opened, unlocked, or resumed from background (`visibilitychange`).
   - Dispatches privacy-safe alerts and atomically writes duplicate-prevention hashes into encrypted storage.

---

## 3. Privacy Design & Anti-Leakage Safeguards

### Mandatory Redaction Rules
Notifications appear on lock screens, shared desktops, paired smartwatches, and vehicle heads-up displays where bystanders or shoulder-surfers may see them.

**Forbidden in Notification Content:**
* ❌ "Your period starts tomorrow"
* ❌ "Your period is expected in 1 day"
* ❌ Specific dates (`2026-09-29`)
* ❌ Words like "period", "menstrual", "bleeding", "flow", "cramps"
* ❌ Fertility, ovulation, or pregnancy estimates
* ❌ Symptoms, energy levels, or mood logs

**Approved Privacy-Safe Strings:**
```typescript
export const PRIVACY_SAFE_NOTIFICATION_COPY = Object.freeze({
  REMINDER: {
    title: 'Aura reminder',
    body: 'You have a private wellness reminder.',
  },
  REMINDER_ALT: {
    title: 'A gentle reminder',
    body: 'Open Aura to view your reminder.',
  },
  TEST: {
    title: 'Aura reminder',
    body: 'This is a notification test.',
  },
});
```

When a user taps or clicks the notification, the browser focuses Aura (`window.focus()`). If the app lock is engaged, the user is presented with the PIN authentication screen. Sensitive cycle data is **only** accessible after PIN derivation succeeds.

---

## 4. Browser & Platform Limitations

### 1. Sound Control
* **Browser Sandbox Boundary:** Web applications cannot override host operating system sound profiles, hardware mute switches, Do Not Disturb, Focus Assist (Windows), or Apple Focus modes.
* **Implementation:**
  * **Silent:** Dispatches notification with `{ silent: true }`.
  * **On + Sound:** Dispatches standard notification (`{ silent: false }`), allowing the user's host OS and browser site permissions to determine the chime or vibration.
* **Honest Design:** No unauthorized autoplay audio elements, hidden iframes, or Web Audio hacks are employed.

### 2. Client-Side Background Scheduling Without a Server
* **Push Service Absence:** In pure client-side, zero-knowledge architectures without centralized push servers (no WebPush/APNs/FCM), browsers cannot wake up in the background at arbitrary future timestamps on platforms that do not support the experimental Notification Triggers API.
* **App-Open Evaluation:** Reminders are evaluated when Aura is opened or resumed from the background.
* **Documentation Rule Honored:** We do not claim that arbitrary future local notifications fire while the device is locked/closed without native push infrastructure.

---

## 5. Duplicate Prevention Mechanism

To prevent notification storms whenever the user launches or refreshes Aura:
1. When a reminder is due for an upcoming cycle target date (e.g. `2026-09-29`), a cryptographic SHA-256 digest is generated:
   $$\text{Hash} = \text{SHA-256}(\text{"aura-notification:period:"} + \text{TargetDate})$$
2. The hash is compared against `settings.notifications.lastDeliveredReminderHash`:
   - If matching: Evaluation returns `due: false` (`reason: 'Reminder has already been delivered for this upcoming cycle.'`).
   - If not matching: Notification dispatches, and the hash is saved to `settings.notifications.lastDeliveredReminderHash` in encrypted IndexedDB.
3. **Zero Plaintext Leakage:** Even if raw IndexedDB records were extracted, the target date itself is never stored in plaintext notification metadata.

---

## 6. Verification Test Results

A dedicated 16-point automated verification suite was authored in [`scripts/test-phase3b-notifications.mjs`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/scripts/test-phase3b-notifications.mjs) and run against `https://172.16.0.2:3000` in Microsoft Edge via CDP.

### Phase 3B Test Matrix

| # | Test Case | Target Assertion | Status | Details |
| :---: | :--- | :--- | :---: | :--- |
| **1** | Notification setting Off | Suppresses notification | **PASS** | Returns `due: false` when mode is `'off'`. |
| **2** | Notification setting Silent | Requests silent delivery | **PASS** | Uses `{ silent: true }` without forced audio. |
| **3** | Notification setting On + Sound | Standard alert behavior | **PASS** | Honors OS sound settings with limitation docs. |
| **4** | Permission granted | Allows alert dispatch | **PASS** | Correctly detects browser permission state. |
| **5** | Permission denied | Fails closed, no prompt | **PASS** | Never re-prompts user once blocked. |
| **6** | Notification API unavailable | Graceful degradation | **PASS** | Returns `unsupported` safely without crashing. |
| **7** | No cycle data | Suppresses reminder | **PASS** | Returns `due: false` if no period history exists. |
| **8** | Cycle prediction available | Uses existing engine | **PASS** | Calculates prediction from existing engine. |
| **9** | Reminder due | Identifies threshold | **PASS** | Returns `due: true` at 1 day before period. |
| **10**| Reminder not due | Outside threshold | **PASS** | Returns `due: false` when $>1$ day remains. |
| **11**| Duplicate prevention | Idempotent delivery | **PASS** | Hash match suppresses duplicate alerts. |
| **12**| Locked state integrity | Memory key sealed | **PASS** | Zero health data decrypted in locked state. |
| **13**| Privacy-safe content | Zero health leakage | **PASS** | Clean text: "Aura reminder", 0 medical terms. |
| **14**| Settings persistence | Survives reload | **PASS** | Preferences preserved across browser refresh. |
| **15**| Settings remain encrypted | AES-256-GCM envelope | **PASS** | `settings_root` verified encrypted in IndexedDB. |
| **16**| Existing PWA still works | Manifest & Service Worker | **PASS** | Service worker and manifest fully functional. |

**Result:** **16/16 Phase 3B Tests Passed (100% Pass Rate)**

---

## 7. Security Architecture & Regression Verification

### Existing Security Test Suites (101/101 Passing)
The complete Phase 2B-2E security suite was executed on the live HTTPS origin:
* `crypto`: **15/15 passed** (AES-256-GCM, PBKDF2 600K iterations, tampering rejection, AAD authentication)
* `keyLifecycle`: **18/18 passed** (PIN validation, memory key wiping on lock, inactivity timer)
* `database`: **5/5 passed** (IndexedDB stores, encrypted CRUD operations)
* `secureStorage`: **10/10 passed** (Encrypted periods, daily logs, settings round-trip)
* `migration`: **18/18 passed** (Atomic migration engine, safety guards, rollback)
* `phase2d`: **18/18 passed** (Migration orchestrator lifecycle, consent UX flow)
* `phase2e`: **17/17 passed** (Legacy plaintext cutover verification, zero storage leaks)

**Zero Security Regressions:** Total assertions passed: **101/101**.

---

## 8. Build & Typecheck Verification

### TypeScript Type Check
```bash
npm run typecheck
> react-example@0.0.0 typecheck
> node ./node_modules/typescript/bin/tsc --noEmit
# Exit Code: 0 (Zero errors)
```

### Production Build & PWA Generation
```bash
npm run build
> react-example@0.0.0 build
> node ./node_modules/vite/bin/vite.js build

vite v6.4.3 building for production...
transforming...
✓ 1703 modules transformed.
rendering chunks...
dist/manifest.webmanifest                          0.73 kB
dist/index.html                                    1.99 kB │ gzip:   0.81 kB
dist/assets/index-DDUD6Jb7.css                    41.80 kB │ gzip:   7.90 kB
dist/assets/workbox-window.prod.es5-BBnX5xw4.js    5.75 kB │ gzip:   2.36 kB
dist/assets/index-B7BCZOMM.js                    430.93 kB │ gzip: 119.77 kB
✓ built in 1.96s

PWA v1.3.0
mode      generateSW
precache  14 entries (1058.20 KiB)
files generated: dist/sw.js, dist/workbox-835c8c05.js
# Exit Code: 0 (Zero errors)
```

---

## 9. Conclusion

Phase 3B is **COMPLETE**. Aura Cycle & Wellness now possesses a private, zero-knowledge reminder notification system with full duplicate prevention, explicit permission handling, settings persistence in encrypted storage, and privacy-safe alert copy. All tests pass across Edge, LAN HTTPS, and PWA environments.
