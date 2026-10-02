import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Phase 3A: Register Progressive Web App Service Worker for offline capability
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      // Promptless auto-update on new build
    },
    onOfflineReady() {
      console.log('Orienta PWA: Offline cache ready');
    },
  });
}
import { keyManager } from './security/keyManager';
import {
  savePeriods,
  loadPeriods,
  saveDailyLogs,
  loadDailyLogs,
  saveSettings,
  loadSettings,
  clearAllSecureData,
  runSecureStorageSmokeTest,
  runPhase2ESmokeTest,
} from './storage/secureStorage';
import { runCryptoSmokeTest } from './security/crypto';
import { runKeyLifecycleSmokeTest } from './security/keyManager';
import { getEncryptedRecord, openVaultDatabase, runDatabaseSmokeTest } from './storage/db';
import { runMigrationSmokeTest } from './storage/migrations';
import { runPhase2DSmokeTest } from './storage/migrationOrchestrator';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  computeReminderHash,
  evaluatePeriodReminder,
  sendPrivacySafeNotification,
  PRIVACY_SAFE_NOTIFICATION_COPY,
  BROWSER_NOTIFICATION_LIMITATIONS,
} from './utils/notifications';

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__security = {
    keyManager,
    savePeriods,
    loadPeriods,
    saveDailyLogs,
    loadDailyLogs,
    saveSettings,
    loadSettings,
    clearAllSecureData,
    getEncryptedRecord,
    openVaultDatabase,
  };

  (window as unknown as Record<string, unknown>).__notifications = {
    isNotificationSupported,
    getNotificationPermission,
    requestNotificationPermission,
    computeReminderHash,
    evaluatePeriodReminder,
    sendPrivacySafeNotification,
    PRIVACY_SAFE_NOTIFICATION_COPY,
    BROWSER_NOTIFICATION_LIMITATIONS,
  };

  (window as unknown as Record<string, unknown>).__runAllSecuritySmokeTests = async () => {
    const crypto = await runCryptoSmokeTest();
    const keyLifecycle = await runKeyLifecycleSmokeTest();
    const database = await runDatabaseSmokeTest();
    const secureStorage = await runSecureStorageSmokeTest();
    const migration = await runMigrationSmokeTest();
    const phase2d = await runPhase2DSmokeTest();
    const phase2e = await runPhase2ESmokeTest();

    return {
      crypto,
      keyLifecycle,
      database,
      secureStorage,
      migration,
      phase2d,
      phase2e,
    };
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
