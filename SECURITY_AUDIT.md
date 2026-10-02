# SECURITY AUDIT & CODEBASE ASSESSMENT

**Application:** Period Tracker & Cycle Calendar (Aura Cycle & Wellness)  
**Date of Audit:** September 27, 2026  
**Auditor Roles:** Senior Software Architect, Application Security Engineer, Full-Stack Engineer, Codebase Auditor  
**Audit Scope:** Full repository static analysis, architectural review, security & threat modeling, mobile/UX evaluation, privacy audit, dependency review, and migration planning.  
**Mode:** AUDIT ONLY (No modifications, dependencies, or code changes applied).

---

## 1. Executive Summary

A comprehensive architectural, security, mobile-responsiveness, and algorithmic audit was performed on the **Period Tracker & Cycle Calendar** application.

### Current State
The project is a standalone, client-side Single Page Application (SPA) built with **React 19**, **TypeScript 5.8**, and **Vite 6.2**. It operates entirely within the user's browser, persisting data into unencrypted `window.localStorage`. 

### Key Findings
1. **Zero External Backend / Zero Cloud Storage:** Currently, the application has no active backend server, API routes, or database. Sensitive menstrual, symptom, sexual/intimate wellness, and mood data are confined to the local browser context. While this provides inherent network privacy (no data in transit to a server), it creates severe device-level vulnerabilities.
2. **Plaintext Local Storage of Sensitive Health Data:** Intimate reproductive health details (cycle dates, bleeding intensity, sexual health notes, physical symptoms, mood swings) are stored unencrypted in `localStorage`. Any script running in the browser context (e.g., third-party scripts, malicious browser extensions, XSS) or anyone with physical access to the device can inspect and extract all health history.
3. **No Authentication or Authorization:** The application has no user accounts, passwords, biometric/passcode locking, or multi-user separation. Multiple people sharing a device or browser profile have unrestricted access to all intimate records.
4. **Phantom Dependencies & Unused Packages:** `@google/genai`, `express`, `dotenv`, and `@types/express` are declared in `package.json`, but are completely unreferenced in the frontend codebase. There is no active server or AI model invocation.
5. **No Native Background Reminders / Notifications:** While notification preferences and a permission trigger exist in UI settings, there is no Service Worker, Web Push API, or scheduled background worker. Notifications only trigger an immediate test pop-up upon permission request.
6. **Not a Progressive Web App (PWA):** The app lacks a `manifest.json`, Web App Manifest registration, Service Worker, and offline caching strategies.
7. **Mobile Usability & Viewport Constraints:** The mobile bottom navigation bar packs 6 interactive elements across viewports as narrow as 360px without accommodating mobile safe areas (`env(safe-area-inset-bottom)`), leading to UI crowding and overlap with device gesture bars.

---

## 2. Current Architecture

### Architecture Overview
The application follows a simple, monolithic client-side component architecture. React manages all application states in root memory ([`App.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/App.tsx)), synchronizing state changes to browser `localStorage` via helper functions in [`storage.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/utils/storage.ts).

### Architectural Breakdown
- **Frontend Framework:** React 19.0.1 (Strict Mode enabled).
- **Language:** TypeScript 5.8.2.
- **Build System:** Vite 6.2.3 with `@tailwindcss/vite` and `@vitejs/plugin-react`.
- **Styling:** TailwindCSS v4 with custom font imports (Google Fonts: *Plus Jakarta Sans* & *Playfair Display*).
- **State Management:** Local React state (`useState`, `useMemo`, `useEffect`) lifted to root [`App.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/App.tsx). No external state library (no Redux, Zustand, or Context API).
- **Routing:** Tab-based conditional rendering in [`App.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/App.tsx) based on `NavigationTab` ('home' | 'calendar' | 'history' | 'insights' | 'settings'). No browser history / HTML5 routing.
- **Persistence:** Synchronous browser `window.localStorage` under three distinct JSON keys.
- **External Network Dependencies:**
  - Google Fonts CDN (`fonts.googleapis.com` & `fonts.gstatic.com`).
- **AI Integration:** None active. `@google/genai` is listed in `package.json` but not imported or called anywhere.

### Actual Architecture Diagram

```
+-------------------------------------------------------------------------+
|                              USER BROWSER                               |
|                                                                         |
|  +--------------------+        +-------------------------------------+  |
|  |     User Input     | -----> |           React Root App            |  |
|  | (Touches / Clicks) |        |             (App.tsx)               |  |
|  +--------------------+        +------------------+------------------+  |
|                                                   |                     |
|                   +-------------------------------+------------------+  |
|                   |                               |                  |  |
|                   v                               v                  v  |
|         +-------------------+           +------------------+  +-----+|  |
|         | Navigation / Tabs |           | Cycle Engine     |  |Modal||  |
|         | - Home            |           | (cycleCalc.ts)   |  |Views||  |
|         | - Calendar        |           +------------------+  +-----+|  |
|         | - History         |                     |                  |  |
|         | - Insights        |                     v                  |  |
|         | - Settings        |           +------------------+         |  |
|         +-------------------+           | Derived Metrics  |         |  |
|                   |                     | (Phases, Preds)  |         |  |
|                   |                     +------------------+         |  |
|                   |                               |                  |  |
|                   +-------------------------------+                  |  |
|                                                   |                  |  |
|                                                   v                  |  |
|                                        +--------------------+        |  |
|                                        | Storage Adapter    | <------+  |
|                                        | (utils/storage.ts) |           |  |
|                                        +----------+---------+           |
|                                                   |                     |
|                                                   v                     |
|                                        +--------------------+           |
|                                        | window.localStorage|           |
|                                        | (Plaintext JSON)   |           |
|                                        +--------------------+           |
+-------------------------------------------------------------------------+
                                     |
               (Only initial CSS font assets fetched)
                                     v
                       +---------------------------+
                       | Google Fonts CDN (HTTPS)  |
                       +---------------------------+
```

---

## 3. Project Structure

```
period-tracker-&-cycle-calendar/
├── .env.example                  # Environment variable reference (Gemini API key, App URL)
├── .gitignore                    # Git exclusions (node_modules, dist, .env*)
├── README.md                     # AI Studio starter readme
├── index.html                    # HTML shell, viewport meta, Google Fonts links
├── metadata.json                 # Google AI Studio applet metadata
├── package.json                  # Project manifest, scripts, and dependencies
├── tsconfig.json                 # TypeScript compiler configurations
├── vite.config.ts                # Vite config (Tailwind, React, dev server settings)
└── src/
    ├── main.tsx                  # React DOM rendering entry point
    ├── App.tsx                   # Master state container, modal management, view router
    ├── index.css                 # Base Tailwind CSS, font definitions, scrollbar styles
    ├── types.ts                  # TypeScript interfaces and union types
    ├── utils/
    │   ├── cycleCalculations.ts  # Date arithmetic, phase computation, weighted prediction
    │   └── storage.ts            # LocalStorage persistence, backup export/import, demo seed
    └── components/
        ├── CalendarView.tsx      # Monthly grid calendar with period & fertile markers
        ├── ConfirmationModal.tsx # Generic dialog for deletions & resets
        ├── CycleCard.tsx         # Circular SVG cycle progress ring and phase highlights
        ├── CycleHistoryView.tsx  # Chronological list of past cycles & consistency bar chart
        ├── DailyLogModal.tsx     # Check-in modal for daily symptoms, mood, energy, notes
        ├── HomeDashboardView.tsx # Primary dashboard view assembling cards & quick logs
        ├── InsightsView.tsx      # Statistical symptom frequency, mood charts, phase guides
        ├── MoodSelector.tsx      # Multi-button mood selector
        ├── Navigation.tsx        # Responsive desktop top bar & mobile bottom bar
        ├── OnboardingModal.tsx   # 4-step onboarding wizard for new profiles
        ├── PeriodLogModal.tsx    # Modal to add/edit period entries (start/end date, flow)
        ├── SettingsView.tsx      # Cycle baselines, notification toggles, backup tools
        └── SymptomSelector.tsx   # Grid selector for physical and emotional symptoms
```

---

## 4. Data Flow Audit

The following table documents every data entity within the application:

| Data Entity | 1. Where Created | 2. Where Stored | 3. Where Read | 4. Where Modified | 5. Leaves Browser? | 6. Sensitive? | 7. Current Protection |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Period Entries** (`startDate`, `endDate`, `flow`, `symptoms`, `mood`, `notes`) | [`PeriodLogModal.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/PeriodLogModal.tsx), [`OnboardingModal.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/OnboardingModal.tsx), or [`DailyLogModal.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/DailyLogModal.tsx) | `localStorage['aura_cycle_periods_v1']` & React state `periods` in [`App.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/App.tsx) | [`App.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/App.tsx), [`cycleCalculations.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/utils/cycleCalculations.ts), [`CalendarView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/CalendarView.tsx), [`CycleHistoryView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/CycleHistoryView.tsx) | [`PeriodLogModal.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/PeriodLogModal.tsx), delete actions in [`CycleHistoryView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/CycleHistoryView.tsx) | **No** (unless user manually clicks "Export Data JSON") | **Highly Sensitive** (Medical / Reproductive Health) | **None** (Plaintext in `localStorage`) |
| **Daily Health Logs** (`date`, `isPeriodDay`, `flow`, `symptoms`, `mood`, `energy`, `notes`) | [`DailyLogModal.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/DailyLogModal.tsx) | `localStorage['aura_cycle_daily_logs_v1']` & React state `dailyLogs` in [`App.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/App.tsx) | [`App.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/App.tsx), [`HomeDashboardView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/HomeDashboardView.tsx), [`CalendarView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/CalendarView.tsx), [`InsightsView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/InsightsView.tsx) | [`DailyLogModal.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/DailyLogModal.tsx) (edit / clear day) | **No** (unless user exports JSON) | **Highly Sensitive** (Intimate physical & emotional daily logs) | **None** (Plaintext in `localStorage`) |
| **User Settings & Profile** (`userName`, `defaultCycleLength`, `defaultPeriodDuration`, `notifications`, `activeProfileId`) | [`OnboardingModal.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/OnboardingModal.tsx) or [`SettingsView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/SettingsView.tsx) | `localStorage['aura_cycle_user_settings_v1']` & React state `settings` in [`App.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/App.tsx) | [`App.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/App.tsx), [`HomeDashboardView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/HomeDashboardView.tsx), [`SettingsView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/SettingsView.tsx), [`cycleCalculations.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/utils/cycleCalculations.ts) | [`SettingsView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/SettingsView.tsx) | **No** | **Low to Moderate** (`userName`, preferences) | **None** (Plaintext in `localStorage`) |
| **Cycle Predictions & Phase Estimates** | Computed in runtime memory via [`cycleCalculations.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/utils/cycleCalculations.ts) | Ephemeral React state (`useMemo` in [`App.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/App.tsx)) | [`CycleCard.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/CycleCard.tsx), [`CalendarView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/CalendarView.tsx), [`InsightsView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/InsightsView.tsx) | Dynamically recalculated whenever `periods` or `settings` update | **No** | **Sensitive** (Fertility & ovulation predictions) | Recomputed in memory; not saved directly to storage |
| **Backup Export File** | [`storage.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/utils/storage.ts) `exportBackupJSON()` triggered from [`SettingsView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/SettingsView.tsx) | Client filesystem (Downloaded `.json` file) | Browser download manager / User file explorer | Handled by OS filesystem | User-controlled file save | **Highly Sensitive** (Complete unencrypted historical record) | **None** (Plaintext unencrypted JSON file) |

---

## 5. Current Storage Security

### Browser Storage Matrix
- **`localStorage`**: **Active** (Used exclusively).
- **`sessionStorage`**: **Not used**.
- **`IndexedDB`**: **Not used**.
- **`Cookies`**: **Not used**.
- **`CacheStorage`**: **Not used**.

### Detailed Breakdown of Stored Keys
1. **`aura_cycle_user_settings_v1`**: Contains user display name, baseline cycle length, baseline period duration, onboarding status, and notification toggle states.
2. **`aura_cycle_periods_v1`**: Array of period objects containing ISO date strings, bleeding flows (`light`, `medium`, `heavy`), symptom arrays, moods, and optional personal notes.
3. **`aura_cycle_daily_logs_v1`**: Key-value map indexed by `YYYY-MM-DD` date strings holding daily check-ins: energy levels (`low`, `normal`, `high`), flow, symptoms, moods, and intimate journal notes.

### Security & Privacy Implications
- **Lack of Encryption at Rest:** HTML5 Web Storage (`localStorage`) is completely unencrypted. Anyone with access to the browser developer tools (`F12` -> Application -> Local Storage) or access to the local user profile folder on disk can read the entire database.
- **Cross-Site Scripting (XSS) Vulnerability:** If any XSS vulnerability is introduced into the application or injected via a third-party dependency, malicious scripts can read `localStorage.getItem(...)` and exfiltrate all reproductive health records in a single payload.
- **Shared Device Exposure:** Without an application lock (PIN, biometric, or password), any friend, family member, or colleague using the device/browser can view the user's cycle phases, fertile days, and intimate daily notes.
- **No Expiration or Automatic Purge:** Data remains in the browser indefinitely until the user manually triggers "Delete All My Data" or clears all browser site data.

---

## 6. Authentication Audit

**"No authentication currently exists."**

- **Login Flow:** Does not exist.
- **Signup Flow:** Does not exist. The application uses a client-side first-time onboarding modal ([`OnboardingModal.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/OnboardingModal.tsx)) that asks for a preferred display name and baseline cycle length, saving them directly to `localStorage`.
- **Session Mechanism:** None.
- **Token Storage:** None (no JWTs, bearer tokens, or session IDs).
- **Logout:** None.
- **Authorization & Multi-Tenancy:** None. The app assumes a single, anonymous local operator.
- **Account Recovery:** Not applicable.

---

## 7. API / Backend Audit

### Backend Existence
The application has **no active backend, no server runtime, and no API routes**.

### Inspection of Potential Network Code
- `fetch()`: 0 occurrences.
- `axios`: 0 occurrences.
- `XMLHttpRequest`: 0 occurrences.
- `WebSocket`: 0 occurrences.
- `navigator.sendBeacon`: 0 occurrences.

### External Network Requests
The only network activity originating from the client is the browser loading external fonts via `<link>` tags in [`index.html`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/index.html):
- `https://fonts.googleapis.com`
- `https://fonts.gstatic.com`

### Server Configuration in Package Manifest
`package.json` specifies `"express": "^4.21.2"` and `"@types/express": "^4.17.21"`, alongside `"clean": "rm -rf dist server.js"`. However:
- No `server.js` or backend entry point exists in the workspace.
- `vite.config.ts` only sets up local Vite development serving.
- No REST, GraphQL, or RPC endpoints exist.

---

## 8. Cycle Calculation Audit

The calculation algorithms are implemented in [`cycleCalculations.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/utils/cycleCalculations.ts).

### Prediction Logic & Formulae
1. **Cycle Day Calculation:**
   $$\text{Cycle Day} = \text{diffInDays}(\text{latestStartDate}, \text{currentDate}) + 1$$
   - Correctly 1-indexed for standard cycle notation.
2. **Cycle Length & Weighted Average:**
   - Evaluates adjacent cycle start dates: `diffInDays(sorted[i].startDate, sorted[i+1].startDate)`.
   - Filters out non-physiological outliers: only accepts intervals between 18 and 65 days.
   - Applies linear weighting giving more emphasis to recent cycles:
     $$\text{Weighted Sum} = \sum (days_i \times (i + 1))$$
3. **Period Duration:**
   - Computes completed period intervals: `diffInDays(startDate, endDate) + 1`.
   - Filters out durations $< 1$ day or $> 14$ days.
   - Falls back to configured default duration (default 5 days) when no completed periods are logged.
4. **Next Expected Period Date:**
   $$\text{Expected Next Start} = \text{addDays}(\text{latestStartDate}, \text{averageCycleLength})$$
5. **Ovulation Estimate:**
   $$\text{Estimated Ovulation} = \text{addDays}(\text{Expected Next Start}, -14)$$
   - Based on standard 14-day luteal phase assumption.
6. **Fertile Window:**
   - Starts 5 days before estimated ovulation: `addDays(ovulationDate, -5)`.
   - Ends 1 day post-ovulation: `addDays(ovulationDate, 1)`.
   - Span = 7 days total.
7. **Phase Classification:**
   - **Menstrual:** Day 1 to `periodDuration`.
   - **Follicular:** End of menstrual phase to `fertileStart - 1`.
   - **Ovulation / Fertile:** `fertileStart` through `fertileEnd`.
   - **Luteal:** `fertileEnd + 1` to end of cycle.
8. **Irregularity Detection:**
   - Calculates half-spread spread variation: `(max - min) / 2`.
   - Flags as irregular if `variation >= 4.5` days (or `variation >= 4` days with 3+ cycles).

### Calculation Weaknesses & Architectural Limitations
1. **Fixed 14-day Luteal Phase Assumption:** The algorithm assumes every person has a 14-day luteal phase ($CycleLength - 14$). In clinical reality, luteal phases vary between 10 and 16 days. For users with cycle lengths of 35+ days or $< 24$ days, fixed subtraction introduces estimation bias.
2. **No Luteal Phase Customization:** Users cannot calibrate their estimated luteal phase length in Settings.
3. **Timezone & Daylight Saving Time Drifts:**
   - In [`cycleCalculations.ts`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/utils/cycleCalculations.ts), `parseLocalDate` constructs dates using midday local time:
     ```ts
     new Date(year, month - 1, day, 12, 0, 0, 0);
     ```
   - This prevents midnight DST rollovers, which is good practice. However, `getTodayDateString()` relies on local machine clock, which can produce date mismatches if a user crosses timezones or if machine time is incorrect.
4. **Missing End Dates on Ongoing Cycles:** If a user logs a period start date but forgets to log an end date, the app assumes bleeding duration is `avgPeriodDuration` for phase calculations, but does not calculate a historical cycle length until the subsequent period start is logged.
5. **Short Cycles Edge Case:** If `cycleLength` is 21 days, `ovulationDay = cycleLength - 14 = 7`. If `periodDuration` is 6 days, the menstrual and follicular phases overlap with the fertile window ($Day\ 7 - 5 = Day\ 2$), causing phase classification precedence anomalies.

---

## 9. Notification Audit

### Current Notification Capabilities
- **Notification API:** The standard browser `window.Notification` API is checked in [`SettingsView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/SettingsView.tsx).
- **Push API:** **Not implemented.**
- **Service Worker Registration:** **Not implemented.**
- **Scheduled Background Reminders:** **Not implemented.**
- **Server-Side Push Reminders:** **Not implemented.**

### Current Behavior
In [`SettingsView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/SettingsView.tsx):
1. A button labeled `"Enable Browser Alerts"` triggers `Notification.requestPermission()`.
2. If granted, it immediately dispatches a single one-off pop-up:
   ```ts
   new Notification('Aura Cycle Tracking', {
     body: 'Notifications enabled! You will receive gentle reminders for your cycle.',
     icon: '/favicon.ico',
   });
   ```
3. Four reminder checkboxes exist in the UI (`periodReminder`, `expectedPeriodReminder`, `fertileWindowReminder`, `dailyTrackingReminder`). These toggles **only update boolean flags in `localStorage`**. There is **no background timer, no `setInterval`, and no Web Worker** listening to these flags. **No reminders will ever be triggered.**

---

## 10. PWA Audit

### PWA Readiness Matrix
- **Web App Manifest (`manifest.json` / `manifest.webmanifest`):** **Missing.**
- **Service Worker (`sw.js` / `service-worker.ts`):** **Missing.**
- **PWA Vite Plugin (`vite-plugin-pwa`):** **Missing.**
- **Installability (Desktop / Mobile Prompt):** **Unsupported.**
- **Offline Caching:** **Unsupported** (HTML and assets require network or browser cache).
- **Standalone App Shell Mode:** **Unsupported.**
- **Icons & Maskable Assets:** Missing standard PWA icon set (`192x192`, `512x512`, apple touch icon).

---

## 11. Mobile UI Audit

### Responsive Viewport Verification
The UI was inspected across standard device breakpoints (360px, 375px, 390px, 414px, 430px).

### Identified Mobile Deficiencies
1. **Overcrowded Bottom Navigation Bar ([`Navigation.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/Navigation.tsx)):**
   - The mobile bottom bar renders 5 text-labeled buttons plus 1 floating center action button: Home, Calendar, Log (+), History, Insights, Settings.
   - At 360px viewport width (e.g., Samsung Galaxy S-series small view), each item receives $< 55$px of horizontal space. Text labels and icons risk touch target collision and accidental taps.
2. **Missing Safe Area Inset Support (`env(safe-area-inset-bottom)`):**
   - In [`Navigation.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/Navigation.tsx), `<nav id="mobile-bottom-navigation" className="fixed bottom-0 ...">` does not declare `pb-[env(safe-area-inset-bottom)]`.
   - On modern iOS (iPhone X through 16) and Android with gesture bars, bottom navigation items will collide directly with the operating system's swipe-up home indicator.
3. **Modal Height Overflow on Mobile Virtual Keyboards:**
   - Both [`PeriodLogModal.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/PeriodLogModal.tsx) and [`DailyLogModal.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/DailyLogModal.tsx) set `max-h-[92vh]`.
   - When a user focuses on the "Notes" textarea, the software keyboard occupies 40–50% of the screen, pushing action buttons off-screen and creating awkward double-scroll containers.
4. **Touch Target Sizing on Calendar Days ([`CalendarView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/CalendarView.tsx)):**
   - Calendar day buttons have class `h-12 sm:h-14 p-1.5`. At 360px width, padding and margin compress day numbers, making it easy to misclick adjacent dates.
5. **Horizontal Spacing on History Cards ([`CycleHistoryView.tsx`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/src/components/CycleHistoryView.tsx)):**
   - Summary statistics cards use `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`. On 360px screens, the 5th card spans full width (`col-span-2`), creating asymmetric vertical rhythm.

---

## 12. Privacy Audit

### Data Collection & Exposure Profile
- **Personal Data Collected:** Preferred name, period dates, bleeding volume, menstrual symptoms, mood states, energy ratings, intimate notes.
- **Data Destination:** 100% stored in client browser `localStorage`.
- **Telemetry / Analytics:** None detected (No Google Analytics, Segment, Mixpanel, or Sentry).
- **Third-Party Data Ingestion:**
  - When loading Google Fonts via [`index.html`](file:///c:/Users/Hritik/Desktop/period-tracker-&-cycle-calendar/index.html), the user's IP address and browser User-Agent are transmitted to Google CDN servers.
- **Notification Text Privacy Risks:**
  - The current placeholder test notification states: `"Aura Cycle Tracking: Notifications enabled! You will receive gentle reminders for your cycle."`
  - In a future notification implementation, explicit text on lock screens (e.g., *"Your period is expected today"* or *"You are entering your fertile window"*) could expose sensitive health data to anyone glancing at the device. Privacy-safe notification masking (e.g., *"Gentle daily wellness reminder"*) will be necessary.

---

## 13. Google GenAI Audit

### Audit of `@google/genai`
1. **Package Declaration:** Listed in `package.json` under `"dependencies": { "@google/genai": "^2.4.0" }`.
2. **Codebase Grep Results:** **0 occurrences** across `src/` (No imports, no SDK instantiation, no API calls).
3. **Environment Reference:** `.env.example` lists `GEMINI_API_KEY="MY_GEMINI_API_KEY"`.
4. **Metadata:** `metadata.json` declares `"majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]`.
5. **Security Risk Assessment:**
   - Currently, no API key is embedded or active in client code.
   - **Crucial Caution:** If `@google/genai` is ever invoked directly within client-side React code (`import.meta.env.VITE_GEMINI_API_KEY`), the API key will be permanently exposed in the compiled browser JavaScript bundle, and raw user health logs could be dispatched across the internet to Google AI servers without explicit privacy consent.

---

## 14. Dependency Audit

### Inventory & Vulnerability Analysis

| Package | Declared Version | Type | Status in Codebase | Security & Maintenance Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **`react`** | `^19.0.1` | Dependency | Active | Current major version. Stable. |
| **`react-dom`** | `^19.0.1` | Dependency | Active | Current major version. Stable. |
| **`lucide-react`** | `^0.546.0` | Dependency | Active | Standard icon library. Safe. |
| **`motion`** | `^12.23.24` | Dependency | Active | Modern animation library. Safe. |
| **`vite`** | `^6.2.3` | Dep & DevDep | Active | Current major version. Note: Duplicate entry in `dependencies` and `devDependencies`. |
| **`@tailwindcss/vite`** | `^4.1.14` | Dependency | Active | Tailwind v4 Vite plugin. |
| **`tailwindcss`** | `^4.1.14` | DevDependency | Active | Core CSS toolchain. |
| **`@google/genai`** | `^2.4.0` | Dependency | **Unused** | Dead dependency. Expands dependency tree unnecessarily. |
| **`express`** | `^4.21.2` | Dependency | **Unused** | Backend framework declared in client SPA package. Dead dependency. |
| **`dotenv`** | `^17.2.3` | Dependency | **Unused** | Node-only environment loader. Not used in Vite frontend. |
| **`@types/express`** | `^4.17.21` | DevDependency | **Unused** | Dead type definition. |
| **`tsx`** | `^4.21.0` | DevDependency | **Unused** | Node TypeScript execution tool. No server script exists to run. |
| **`typescript`** | `~5.8.2` | DevDependency | Active | Current TypeScript compiler. |
| **`package-lock.json`**| *None* | File | **Missing** | Missing lockfile leads to non-deterministic dependency installations. |

---

## 15. Build & Code Quality Audit

Safe diagnostics were executed on the repository without modifying any files.

### 1. `npm run lint` (`tsc --noEmit`)
- **Execution Command:** `npm run lint`
- **Result:** **Failed (Exit code 1)**
- **Console Output:**
  ```
  > react-example@0.0.0 lint
  > tsc --noEmit

  'tsc' is not recognized as an internal or external command,
  operable program or batch file.
  ```
- **Root Cause:** Dependencies have not been installed in the repository workspace (`node_modules` does not exist, and no `package-lock.json` exists).

### 2. `npm run build` (`vite build`)
- **Execution Command:** `npm run build`
- **Result:** **Failed (Exit code 1)**
- **Console Output:**
  ```
  > react-example@0.0.0 build
  > vite build

  'vite' is not recognized as an internal or external command,
  operable program or batch file.
  ```
- **Root Cause:** Same as above. `vite` binary is missing due to uninstalled `node_modules`.

---

## 16. Security Threat Model

The threat model evaluates the application against real-world risks:

| Threat Category | Specific Threat | Severity | Likelihood | Reason & Technical Context |
| :--- | :--- | :--- | :--- | :--- |
| **Data Attacks** | Local Storage Exposure & Insecure Storage at Rest | **Critical** | High | All intimate cycle, mood, and symptom logs are stored in plaintext in `window.localStorage`. Accessible to any local user or any XSS vector. |
| **Account Attacks** | Lack of Device / App Lockout | **High** | High | No passcode, PIN, or biometric barrier prevents physical bystanders from inspecting sensitive reproductive health history. |
| **Web Attacks** | Cross-Site Scripting (XSS) Impact | **High** | Medium | Because `localStorage` is accessible synchronously via JavaScript, any script injection can immediately steal complete health history. |
| **Infrastructure** | Client-Side API Key Leakage (Future AI) | **High** | High | `@google/genai` dependency is present; attempting client-side GenAI integration would expose user Gemini API keys in client-side network tabs. |
| **Data Attacks** | Unencrypted JSON Data Backup Export | **Medium** | Medium | Exported JSON files downloaded to desktop or phone storage contain raw cycle records without password protection or encryption. |
| **PWA / Browser** | Notification Lock-Screen Privacy Leakage | **Medium** | High | Plaintext notifications alerting about fertility windows or menstruation expose private medical details on lock screens. |
| **Authorization** | Multi-User Bleed / No Profile Isolation | **Medium** | Medium | If multiple family members share a device, all data is combined in a single unauthenticated profile. |
| **Web Attacks** | Dependency Supply-Chain Tampering | **Low** | Medium | Missing `package-lock.json` causes build instability and potential exposure to unpinned upstream supply-chain risks upon fresh `npm install`. |

---

## 17. Risk Register

| Risk ID | Vulnerability / Issue | Severity | Status | Recommended Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | Plaintext menstrual & symptom storage in `localStorage` | **Critical** | Open | Migrate to encrypted storage (Web Crypto API + AES-GCM) with client-side derived key or secure backend database. |
| **RSK-02** | Absence of authentication or application lock | **High** | Open | Implement secure authentication or optional local client-side PIN/Biometric App Lock. |
| **RSK-03** | Missing lockfile (`package-lock.json`) | **High** | Open | Generate clean, deterministic `package-lock.json` via clean install. |
| **RSK-04** | Notification feature advertised in UI but not functional | **Medium** | Open | Implement Service Worker, Web Notifications, and background scheduling. |
| **RSK-05** | Phantom/dead dependencies (`express`, `dotenv`, `@google/genai`) | **Medium** | Open | Prune unused dependencies from `package.json` to reduce attack surface. |
| **RSK-06** | Mobile bottom navigation crowding & missing safe-area padding | **Medium** | Open | Redesign mobile bar with 4-5 primary tabs and apply `env(safe-area-inset-bottom)`. |
| **RSK-07** | Inability to run builds or linting without prior setup | **Medium** | Open | Document clear bootstrapping steps and verify reproducible builds. |
| **RSK-08** | Fixed 14-day luteal phase calculation limitation | **Low** | Open | Permit user luteal phase customization (10–16 days) in settings. |

---

## 18. Recommended Architecture

To achieve a production-grade, secure, privacy-respecting cycle tracking application, we propose transitioning toward the following target architecture:

```
+------------------------------------------------------------------------------------+
|                                 CLIENT (PWA / React)                               |
|                                                                                    |
|  +--------------------+        +---------------------+      +-------------------+  |
|  |   App Lock Modal   | -----> | React UI Components | <--> | Service Worker    |  |
|  |  (PIN / Biometric) |        +----------+----------+      | - Offline Cache   |  |
|  +--------------------+                   |                 | - Local Push/Alarm|  |
|                                           v                 +---------+---------+  |
|                               +------------------------+              |            |
|                               | Local Privacy Vault    |              |            |
|                               | (WebCrypto AES-256-GCM)|              |            |
|                               | IndexedDB Storage      |              |            |
|                               +-----------+------------+              |            |
+-------------------------------------------|---------------------------|------------+
                                            | (Optional Sync)           |
                                            v                           v
                               +-------------------------+    +-------------------+
                               | Secure API Gateway      |    | Web Push Server   |
                               | (HTTPS / OAuth2 / JWT)  |    | (VAPID / RFC8291) |
                               +------------+------------+    +-------------------+
                                            |
                                            v
                               +-------------------------+
                               | Isolated User DB        |
                               | (Zero-Knowledge / Row   |
                               | Level Security)         |
                               +-------------------------+
```

### Core Architecture Pillars:
1. **Client-Side Encryption at Rest (Local Vault):**
   - Use the browser's native **Web Crypto API** (`SubtleCrypto`) to encrypt all cycle records, notes, and symptoms using **AES-256-GCM**.
   - Encrypted payloads stored in **IndexedDB** rather than synchronous `localStorage`.
2. **App Lock / Privacy Shield:**
   - Optional local PIN or WebAuthn biometric unlocking to prevent physical device snooping.
3. **PWA & Offline-First Resiliency:**
   - Web App Manifest + Service Worker using Cache-First strategy for static assets.
4. **Smart Reminders with Privacy Masking:**
   - Service Worker notification scheduler with customizable discreet reminder text (e.g., *"Wellness check-in reminder"* instead of *"Period tomorrow"*).
5. **Isolated Optional Backend Sync:**
   - If cloud sync is introduced, implement zero-knowledge encryption where data is encrypted client-side before dispatch to APIs.

---

## 19. Phased Migration Plan

Below is the structured 12-phase technical roadmap for future implementation:

```
[Phase 1: Audit] (Completed)
       │
       ▼
[Phase 2: Security Foundation] ──► [Phase 3: Auth & App Lock] ──► [Phase 4: Secure Data Storage]
                                                                                │
                                                                                ▼
[Phase 7: Cycle Predictions]  ◄── [Phase 6: PWA Support]      ◄── [Phase 5: Mobile UI Polish]
       │
       ▼
[Phase 8: Smart Reminders]    ──► [Phase 9: Notification UI]  ──► [Phase 10: Privacy Center]
                                                                                │
                                                                                ▼
[Phase 12: Production Launch] ◄────────────────────────────────── [Phase 11: Security Testing]
```

### Phase 1: Audit & Baseline Analysis *(Current Phase)*
- **Objective:** Deep inspection, static analysis, threat modeling, and documentation.
- **Affected Files:** None modified. Creation of `SECURITY_AUDIT.md`.
- **Dependencies:** None.
- **Risks:** None.

### Phase 2: Security Foundation & Dependency Cleanup
- **Objective:** Prune unused dependencies (`express`, `dotenv`, `@google/genai`), deduplicate `vite`, generate deterministic `package-lock.json`, and ensure clean baseline lint and build.
- **Affected Files:** `package.json`, `package-lock.json`, `vite.config.ts`.
- **Dependencies Required:** Existing clean set.
- **Risks:** Accidental removal of transitively needed dev tools.
- **Tests Required:** `npm run lint` and `npm run build` pass cleanly with zero errors.

### Phase 3: Authentication, App Lock & Session Management
- **Objective:** Introduce local passcode/PIN lock mechanism with WebCrypto PBKDF2 hashing, session timeout, and optional cloud auth architecture.
- **Affected Files:** `src/components/AppLockModal.tsx`, `src/utils/crypto.ts`, `src/App.tsx`.
- **Dependencies:** None (uses native `window.crypto.subtle`).
- **Risks:** User forgetting PIN lock requires a clear recovery/reset path.
- **Tests Required:** Lockout verification, timeout after background inactivity, incorrect PIN rejection.

### Phase 4: Secure Data Architecture (Encrypted IndexedDB)
- **Objective:** Migrate from synchronous plaintext `localStorage` to encrypted asynchronous IndexedDB storage utilizing AES-GCM.
- **Affected Files:** `src/utils/storage.ts`, `src/utils/db.ts`, `src/App.tsx`.
- **Dependencies:** Lightweight IndexedDB wrapper (e.g., `idb`) or vanilla IndexedDB.
- **Risks:** Data migration loss during upgrade from v1 `localStorage` to encrypted v2 store.
- **Tests Required:** Backward-compatible migration tests; data remains encrypted on disk.

### Phase 5: Mobile-First UX & Viewport Polish
- **Objective:** Fix safe-area insets (`env(safe-area-inset-bottom)`), optimize bottom navigation touch targets (5-tab refined layout), resolve modal keyboard scrolling.
- **Affected Files:** `src/components/Navigation.tsx`, `src/components/DailyLogModal.tsx`, `src/components/PeriodLogModal.tsx`, `src/components/CalendarView.tsx`.
- **Dependencies:** None.
- **Risks:** CSS layout regression on tablet/desktop viewports.
- **Tests Required:** Visual regression testing on 360px, 375px, 390px, 414px, and 430px viewports.

### Phase 6: Progressive Web App (PWA) Implementation
- **Objective:** Implement Web App Manifest, Service Worker offline caching, app icons, and install prompts.
- **Affected Files:** `index.html`, `public/manifest.json`, `public/sw.js`, `vite.config.ts`.
- **Dependencies:** `vite-plugin-pwa`.
- **Risks:** Stale cache invalidation bugs.
- **Tests Required:** Lighthouse PWA audit score 100%; offline navigation test.

### Phase 7: Cycle Prediction Engine Improvements
- **Objective:** Support customizable luteal phase lengths (10–16 days), enhanced irregular cycle handling, and short-cycle safety guards.
- **Affected Files:** `src/utils/cycleCalculations.ts`, `src/types.ts`, `src/components/SettingsView.tsx`.
- **Dependencies:** None.
- **Risks:** Inaccurate phase dates if user sets extreme parameters.
- **Tests Required:** Unit tests for standard 28-day, short 21-day, long 38-day, and irregular cycles.

### Phase 8: Smart Period & Ovulation Reminders
- **Objective:** Implement reliable scheduled notifications via Service Worker alarms/Notification API with duplicate suppression.
- **Affected Files:** `src/utils/notifications.ts`, `public/sw.js`.
- **Dependencies:** Web Notifications API.
- **Risks:** Browser background throttling on inactive tabs.
- **Tests Required:** Triggering scheduled notifications at simulated dates/times.

### Phase 9: Notification Preferences & Privacy Masking
- **Objective:** Provide granular controls (Period heads-up, Ovulation, Daily tracking) with sound/silent options and discreet notification text masking.
- **Affected Files:** `src/components/SettingsView.tsx`, `src/types.ts`.
- **Dependencies:** None.
- **Risks:** Missed notifications if user enables sound-only on muted device.
- **Tests Required:** Verification of masked vs. explicit notification titles.

### Phase 10: Privacy Center & Data Control Center
- **Objective:** Encrypted JSON export/import with passphrase protection, selective history deletion, and clear privacy dashboard.
- **Affected Files:** `src/components/SettingsView.tsx`, `src/utils/storage.ts`.
- **Dependencies:** None.
- **Risks:** Exported passphrase forgotten by user.
- **Tests Required:** Import/export round-trip test with valid and invalid passphrases.

### Phase 11: Comprehensive Security & Penetration Testing
- **Objective:** Perform automated static application security testing (SAST), dependency vulnerability scans (`npm audit`), and manual XSS penetration testing.
- **Affected Files:** Entire codebase.
- **Dependencies:** Security linters.
- **Risks:** Uncovering previously unidentified architectural flaws.
- **Tests Required:** Zero critical/high vulnerability findings; zero unencoded user input sinks.

### Phase 12: Production Hardening & Deployment Setup
- **Objective:** Configure strict Content Security Policy (CSP), HTTP security headers, subresource integrity, and production bundle minification.
- **Affected Files:** `index.html`, `vite.config.ts`, hosting configuration.
- **Dependencies:** None.
- **Risks:** CSP headers accidentally blocking Google Fonts or Service Worker scripts.
- **Tests Required:** Complete production deployment dry-run and cross-browser validation.

---

## 20. Final Recommendations

1. **Keep Audit Mode Closed:** Do not apply hasty ad-hoc fixes. Maintain the phased migration sequence.
2. **Prioritize Phase 2 (Clean Dependency Baseline):** Before adding authentication or encryption, generate a deterministic `package-lock.json` and ensure standard build/lint passes cleanly.
3. **Adopt Client-Side Zero-Knowledge Encryption:** Because of the heightened sensitivity of menstrual and fertility data, avoid plaintext browser storage and unencrypted cloud sync.
4. **Implement Discreet Notification Content:** Ensure notification payloads never display explicit reproductive health terms on locked mobile screens.

---
*End of Security Audit Report.*
