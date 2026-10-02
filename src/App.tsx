/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CycleCalculationResult,
  CycleStatistics,
  DailyLog,
  NavigationTab,
  PeriodEntry,
  UserSettings,
} from './types';
import {
  calculateAllCycleData,
  calculateCycleStatistics,
  getTodayDateString,
} from './utils/cycleCalculations';
import {
  DEFAULT_SETTINGS,
  getSampleDemoData,
} from './utils/storage';
import {
  clearAllSecureData,
  loadDailyLogs,
  loadPeriods,
  loadSettings,
  saveDailyLogs,
  savePeriods,
  saveSettings,
} from './storage/secureStorage';
import {
  cleanupLegacyDataAfterVerifiedMigration,
  hasLegacyData,
} from './storage/migrations';
import { migrationOrchestrator } from './storage/migrationOrchestrator';
import {
  isNotificationSupported,
  getNotificationPermission,
  evaluatePeriodReminder,
  sendPrivacySafeNotification,
} from './utils/notifications';

// Components
import { Navigation } from './components/Navigation';
import { HomeDashboardView } from './components/HomeDashboardView';
import { CalendarView } from './components/CalendarView';
import { CycleHistoryView } from './components/CycleHistoryView';
import { InsightsView } from './components/InsightsView';
import { SettingsView } from './components/SettingsView';
import { PeriodLogModal } from './components/PeriodLogModal';
import { DailyLogModal } from './components/DailyLogModal';
import { OnboardingModal } from './components/OnboardingModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { SecurityProvider, useSecurity } from './security/SecurityContext';
import { LockScreen } from './components/LockScreen';
import { MigrationModal } from './components/MigrationModal';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

function AppContent() {
  const { isUnlocked, lock, withUnlockedKey } = useSecurity();
  const todayStr = getTodayDateString();

  // Primary State - Zero plaintext health data before unlock
  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [periods, setPeriods] = useState<PeriodEntry[]>([]);
  const [dailyLogs, setDailyLogs] = useState<Record<string, DailyLog>>({});

  // Vault Loading & Error States
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Modals & Drawers
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<PeriodEntry | null>(null);
  const [periodDefaultStartDate, setPeriodDefaultStartDate] = useState<string>(todayStr);

  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);
  const [selectedDateForDaily, setSelectedDateForDaily] = useState<string>(todayStr);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  const [deletingPeriodId, setDeletingPeriodId] = useState<string | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  // Micro-interaction: Toast Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Controlled Data Migration State (Phase 2D/2E)
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [hasCheckedMigration, setHasCheckedMigration] = useState(false);
  const [legacyDataExists, setLegacyDataExists] = useState(() => hasLegacyData());

  // 1. Vault Lock/Unlock Lifecycle Handler
  useEffect(() => {
    if (!isUnlocked) {
      // PURGE ALL SENSITIVE DECRYPTED DATA FROM RUNTIME MEMORY
      setPeriods([]);
      setDailyLogs({});
      setSettings(DEFAULT_SETTINGS);
      setIsDataLoaded(false);
      setIsLoadingData(false);
      setStorageError(null);
      setHasCheckedMigration(false);
      return;
    }

    let isMounted = true;

    async function loadUnlockedVault() {
      setIsLoadingData(true);
      setStorageError(null);

      try {
        await withUnlockedKey(async (key) => {
          // Check for legacy migration eligibility first
          const eligibility = await migrationOrchestrator.checkEligibility(key);
          if (!isMounted) return;

          setHasCheckedMigration(true);
          if (eligibility.eligible) {
            setIsMigrationModalOpen(true);
            setIsLoadingData(false);
            return;
          }

          // Load decrypted data from encrypted IndexedDB vault
          const [loadedSettings, loadedPeriods, loadedDailyLogs] = await Promise.all([
            loadSettings(key),
            loadPeriods(key),
            loadDailyLogs(key),
          ]);

          if (!isMounted) return;

          if (loadedSettings) {
            setSettings(loadedSettings);
            setIsOnboardingOpen(!loadedSettings.hasCompletedOnboarding);
          } else {
            // First time vault is opened: persist DEFAULT_SETTINGS to IndexedDB
            setSettings(DEFAULT_SETTINGS);
            await saveSettings(key, DEFAULT_SETTINGS);
            setIsOnboardingOpen(true);
          }

          setPeriods(loadedPeriods ?? []);
          setDailyLogs(loadedDailyLogs ?? {});
          setIsDataLoaded(true);
          setIsLoadingData(false);
        });
      } catch (err) {
        if (!isMounted) return;
        setIsLoadingData(false);
        setStorageError(
          err instanceof Error
            ? err.message
            : 'Failed to access or decrypt your secure health vault. Data access has been sealed.'
        );
      }
    }

    loadUnlockedVault();

    return () => {
      isMounted = false;
    };
  }, [isUnlocked, withUnlockedKey]);

  // Handler: Migration Completed
  const handleMigrationComplete = async () => {
    setLegacyDataExists(hasLegacyData());
    setIsMigrationModalOpen(false);

    try {
      await withUnlockedKey(async (key) => {
        const [loadedSettings, loadedPeriods, loadedDailyLogs] = await Promise.all([
          loadSettings(key),
          loadPeriods(key),
          loadDailyLogs(key),
        ]);

        if (loadedSettings) {
          setSettings(loadedSettings);
          setIsOnboardingOpen(!loadedSettings.hasCompletedOnboarding);
        }
        setPeriods(loadedPeriods ?? []);
        setDailyLogs(loadedDailyLogs ?? {});
        setIsDataLoaded(true);
      });
    } catch {
      setStorageError('Error reading migrated records from encrypted vault.');
    }
  };

  // Derived Calculations
  const calcResult: CycleCalculationResult = useMemo(() => {
    return calculateAllCycleData(periods, settings, todayStr);
  }, [periods, settings, todayStr]);

  const stats: CycleStatistics = useMemo(() => {
    return calculateCycleStatistics(periods, dailyLogs, settings);
  }, [periods, dailyLogs, settings]);

  // Phase 3B: App Open & Resume Period Reminder Check
  const hasEvaluatedRemindersRef = useRef(false);

  useEffect(() => {
    if (!isUnlocked || !isDataLoaded) {
      hasEvaluatedRemindersRef.current = false;
      return;
    }

    if (hasEvaluatedRemindersRef.current) return;
    hasEvaluatedRemindersRef.current = true;

    async function checkPeriodReminder() {
      const mode = settings.notifications?.periodReminderMode ?? 'off';
      if (mode === 'off') return;

      if (!isNotificationSupported() || getNotificationPermission() !== 'granted') return;

      const evalResult = await evaluatePeriodReminder(calcResult, settings);
      if (!evalResult.due || !evalResult.targetDateHash) return;

      const result = await sendPrivacySafeNotification({
        mode,
        isTest: false,
      });

      if (result.success) {
        const updatedSettings: UserSettings = {
          ...settings,
          notifications: {
            ...settings.notifications,
            lastDeliveredReminderHash: evalResult.targetDateHash,
            lastDeliveredAt: new Date().toISOString(),
          },
        };

        setSettings(updatedSettings);
        try {
          await withUnlockedKey(async (key) => {
            await saveSettings(key, updatedSettings);
          });
        } catch {
          // Fail-safe
        }
      }
    }

    checkPeriodReminder();
  }, [isUnlocked, isDataLoaded, calcResult, settings, withUnlockedKey]);

  // Re-check on app resume/visibility change (duplicate prevention ensures idempotency)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isUnlocked && isDataLoaded) {
        hasEvaluatedRemindersRef.current = false;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isUnlocked, isDataLoaded]);

  // Handler: Open Period Logger
  const handleOpenNewPeriod = (startDate?: string) => {
    setEditingPeriod(null);
    setPeriodDefaultStartDate(startDate || todayStr);
    setIsPeriodModalOpen(true);
  };

  const handleEditPeriod = (period: PeriodEntry) => {
    setEditingPeriod(period);
    setPeriodDefaultStartDate(period.startDate);
    setIsPeriodModalOpen(true);
  };

  const handleSavePeriod = async (entry: PeriodEntry) => {
    const updatedPeriods = periods.some((p) => p.id === entry.id)
      ? periods.map((p) => (p.id === entry.id ? entry : p))
      : [entry, ...periods];

    let updatedDailyLogs = dailyLogs;
    if (entry.flow || (entry.symptoms && entry.symptoms.length > 0)) {
      updatedDailyLogs = {
        ...dailyLogs,
        [entry.startDate]: {
          date: entry.startDate,
          isPeriodDay: true,
          flow: entry.flow,
          symptoms: entry.symptoms || [],
          mood: entry.mood,
          notes: entry.notes,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    setPeriods(updatedPeriods);
    if (updatedDailyLogs !== dailyLogs) {
      setDailyLogs(updatedDailyLogs);
    }

    try {
      await withUnlockedKey(async (key) => {
        await savePeriods(key, updatedPeriods);
        if (updatedDailyLogs !== dailyLogs) {
          await saveDailyLogs(key, updatedDailyLogs);
        }
      });
      showToast('Period recorded securely');
    } catch (err) {
      setStorageError('Failed to securely save period entry to encrypted vault.');
    }
  };

  const handleDeletePeriod = (id: string) => {
    setDeletingPeriodId(id);
  };

  const confirmDeletePeriod = async () => {
    if (deletingPeriodId) {
      const updated = periods.filter((p) => p.id !== deletingPeriodId);
      setPeriods(updated);
      setDeletingPeriodId(null);

      try {
        await withUnlockedKey(async (key) => {
          await savePeriods(key, updated);
        });
        showToast('Period entry removed');
      } catch (err) {
        setStorageError('Failed to securely update period entries after deletion.');
      }
    }
  };

  // Handler: Open Daily Logger
  const handleOpenDateLog = (dateStr: string) => {
    setSelectedDateForDaily(dateStr);
    setIsDailyModalOpen(true);
  };

  const handleSaveDailyLog = async (log: DailyLog) => {
    const updatedDailyLogs = {
      ...dailyLogs,
      [log.date]: log,
    };
    setDailyLogs(updatedDailyLogs);

    let updatedPeriods = periods;
    if (log.isPeriodDay) {
      const alreadyCovered = periods.some((p) => {
        if (p.startDate === log.date) return true;
        if (p.endDate && log.date >= p.startDate && log.date <= p.endDate) return true;
        return false;
      });

      if (!alreadyCovered) {
        const singlePeriod: PeriodEntry = {
          id: `period-daily-${Date.now()}`,
          startDate: log.date,
          endDate: log.date,
          flow: log.flow || 'medium',
          symptoms: log.symptoms,
          mood: log.mood,
          notes: log.notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updatedPeriods = [singlePeriod, ...periods];
        setPeriods(updatedPeriods);
      }
    }

    try {
      await withUnlockedKey(async (key) => {
        await saveDailyLogs(key, updatedDailyLogs);
        if (updatedPeriods !== periods) {
          await savePeriods(key, updatedPeriods);
        }
      });
      showToast('Daily check-in saved');
    } catch (err) {
      setStorageError('Failed to securely save daily log to encrypted vault.');
    }
  };

  const handleDeleteDailyLog = async (dateStr: string) => {
    const copy = { ...dailyLogs };
    delete copy[dateStr];
    setDailyLogs(copy);

    try {
      await withUnlockedKey(async (key) => {
        await saveDailyLogs(key, copy);
      });
      showToast('Day log cleared');
    } catch (err) {
      setStorageError('Failed to securely update daily logs in encrypted vault.');
    }
  };

  // Handler: Settings & Onboarding
  const handleUpdateSettings = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    try {
      await withUnlockedKey(async (key) => {
        await saveSettings(key, newSettings);
      });
      showToast('Preferences updated');
    } catch (err) {
      setStorageError('Failed to securely save settings to encrypted vault.');
    }
  };

  const handleCompleteOnboarding = async (
    newSettings: Partial<UserSettings>,
    firstPeriod?: PeriodEntry
  ) => {
    const updatedSettings = {
      ...settings,
      ...newSettings,
      hasCompletedOnboarding: true,
    };
    setSettings(updatedSettings);

    const updatedPeriods = firstPeriod ? [firstPeriod] : periods;
    if (firstPeriod) {
      setPeriods(updatedPeriods);
    }
    setIsOnboardingOpen(false);

    try {
      await withUnlockedKey(async (key) => {
        await saveSettings(key, updatedSettings);
        if (firstPeriod) {
          await savePeriods(key, updatedPeriods);
        }
      });
    } catch (err) {
      setStorageError('Failed to securely save onboarding setup.');
    }
  };

  const handleLoadDemoData = async () => {
    const demo = getSampleDemoData();
    const demoSettings: UserSettings = {
      ...settings,
      userName: 'Sophia',
      hasCompletedOnboarding: true,
      defaultCycleLength: 29,
      defaultPeriodDuration: 5,
    };
    setPeriods(demo.periods);
    setDailyLogs(demo.dailyLogs);
    setSettings(demoSettings);
    setActiveTab('home');

    try {
      await withUnlockedKey(async (key) => {
        await savePeriods(key, demo.periods);
        await saveDailyLogs(key, demo.dailyLogs);
        await saveSettings(key, demoSettings);
      });
    } catch (err) {
      setStorageError('Failed to securely save demo records to encrypted vault.');
    }
  };

  const handleClearAllData = () => {
    setIsConfirmClearOpen(true);
  };

  const confirmClearAll = async () => {
    setPeriods([]);
    setDailyLogs({});
    setSettings(DEFAULT_SETTINGS);
    setIsConfirmClearOpen(false);
    setIsOnboardingOpen(true);

    try {
      await clearAllSecureData();
      cleanupLegacyDataAfterVerifiedMigration();
    } catch (err) {
      setStorageError('Failed to securely clear encrypted vault data.');
    }
  };

  const handleImportData = async (imported: {
    settings?: UserSettings;
    periods?: PeriodEntry[];
    dailyLogs?: Record<string, DailyLog>;
  }) => {
    const nextSettings = imported.settings ? { ...DEFAULT_SETTINGS, ...imported.settings } : settings;
    const nextPeriods = Array.isArray(imported.periods) ? imported.periods : periods;
    const nextDailyLogs =
      imported.dailyLogs && typeof imported.dailyLogs === 'object' ? imported.dailyLogs : dailyLogs;

    setSettings(nextSettings);
    setPeriods(nextPeriods);
    setDailyLogs(nextDailyLogs);

    try {
      await withUnlockedKey(async (key) => {
        if (imported.settings) await saveSettings(key, nextSettings);
        if (imported.periods) await savePeriods(key, nextPeriods);
        if (imported.dailyLogs) await saveDailyLogs(key, nextDailyLogs);
      });
    } catch (err) {
      setStorageError('Failed to securely persist imported backup to encrypted vault.');
    }
  };

  if (!isUnlocked) {
    return <LockScreen />;
  }

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-[#FFF8FA] flex flex-col items-center justify-center p-6 text-[#2B171B] relative overflow-hidden">
        {/* Decorative background aura bloom */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-[#FCE4EC] opacity-60 blur-3xl pointer-events-none animate-aura-pulse" />

        <div className="relative z-10 flex flex-col items-center space-y-4 max-w-sm text-center card-fade-in">
          <div className="flex items-center gap-3 animate-aura-pulse">
            <img
              src="/orienta-symbol.png"
              alt="Orienta Logo Symbol"
              className="w-14 h-14 rounded-2xl object-contain shadow-xs shrink-0"
            />
            <div className="flex flex-col text-left justify-center leading-none">
              <span className="text-2xl font-bold text-[#2B171B] tracking-tight font-sans">
                Orienta
              </span>
              <span className="text-xs text-[#795B62] font-medium tracking-wide mt-1">
                by FillFlow
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xl font-bold font-serif text-[#2B171B]">
              Opening Your Private Vault
            </h3>
            <p className="text-xs text-[#795B62] leading-relaxed max-w-xs">
              Restoring your cycle predictions, symptoms, and notes securely...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8FA] text-[#2B171B] flex flex-col font-sans pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-12 selection:bg-[#FCE4EC] selection:text-[#8B0000]">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div
          id="aura-app-toast"
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-[#2B171B] text-white text-xs font-semibold shadow-xl border border-white/10 flex items-center gap-2 card-fade-in"
        >
          <span className="w-2 h-2 rounded-full bg-[#E91E63] animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigation Header / Bottom Bar */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenLogPeriod={() => handleOpenNewPeriod()}
        onLock={lock}
      />

      {/* Main App Content View Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-4 sm:pt-8 card-fade-in">
        {storageError && (
          <div className="mb-6 p-4 rounded-2xl bg-[#FFEBEE] border border-[#FFCDD2] text-[#B71C1C] flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold">Vault Security Alert</p>
              <p>{storageError}</p>
              <p className="text-[11px] opacity-80">
                Access has failed closed to protect your reproductive health privacy. Try locking and unlocking your vault with your PIN.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'home' && (
          <HomeDashboardView
            settings={settings}
            periods={periods}
            dailyLogs={dailyLogs}
            calcResult={calcResult}
            stats={stats}
            onOpenLogPeriod={() => handleOpenNewPeriod()}
            onOpenLogToday={() => handleOpenDateLog(todayStr)}
            onSelectDate={handleOpenDateLog}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#2B171B] font-serif">
                  Cycle Calendar
                </h2>
                <p className="text-sm text-[#795B62]">
                  Track bleeding, estimated fertile windows, and future predictions
                </p>
              </div>

              <button
                id="calendar-page-log-period-btn"
                onClick={() => handleOpenNewPeriod()}
                className="self-start sm:self-center px-4 py-2.5 rounded-xl bg-[#8B0000] text-white text-xs font-semibold hover:bg-[#6D0000] transition-colors shadow-xs"
              >
                + Log Period
              </button>
            </div>

            <CalendarView
              periods={periods}
              dailyLogs={dailyLogs}
              calcResult={calcResult}
              onSelectDate={handleOpenDateLog}
              selectedDate={selectedDateForDaily}
            />

            {/* Selected Date Summary Banner */}
            <div className="bg-white rounded-3xl p-6 border border-[#F5E6E8] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#2B171B]">
                  Looking for a specific date?
                </h3>
                <p className="text-xs text-[#795B62] mt-0.5">
                  Click any calendar date above to record flow, cramps, moods, or intimate notes.
                </p>
              </div>

              <button
                onClick={() => handleOpenDateLog(todayStr)}
                className="px-4 py-2 rounded-xl bg-[#FFF0F4] text-[#8B0000] text-xs font-semibold hover:bg-[#FCE4EC] transition-colors"
              >
                Open Today's Log
              </button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <CycleHistoryView
            periods={periods}
            calcResult={calcResult}
            onEditPeriod={handleEditPeriod}
            onDeletePeriod={handleDeletePeriod}
            onAddNewPeriod={() => handleOpenNewPeriod()}
          />
        )}

        {activeTab === 'insights' && (
          <InsightsView calcResult={calcResult} stats={stats} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            periods={periods}
            dailyLogs={dailyLogs}
            onUpdateSettings={handleUpdateSettings}
            onClearAllData={handleClearAllData}
            onLoadDemoData={handleLoadDemoData}
            onRestartOnboarding={() => setIsOnboardingOpen(true)}
            onLock={lock}
            hasLegacyData={legacyDataExists}
            onOpenMigration={() => setIsMigrationModalOpen(true)}
            onImportData={handleImportData}
          />
        )}
      </main>

      {/* Period Log Modal */}
      <PeriodLogModal
        isOpen={isPeriodModalOpen}
        onClose={() => setIsPeriodModalOpen(false)}
        onSavePeriod={handleSavePeriod}
        onDeletePeriod={handleDeletePeriod}
        initialEntry={editingPeriod}
        defaultStartDate={periodDefaultStartDate}
      />

      {/* Daily Tracking Modal */}
      <DailyLogModal
        isOpen={isDailyModalOpen}
        dateStr={selectedDateForDaily}
        onClose={() => setIsDailyModalOpen(false)}
        existingLog={dailyLogs[selectedDateForDaily]}
        onSaveLog={handleSaveDailyLog}
        onDeleteLog={handleDeleteDailyLog}
        onLogAsPeriod={handleOpenNewPeriod}
      />

      {/* First-time Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onComplete={handleCompleteOnboarding}
        onClose={() => setIsOnboardingOpen(false)}
      />

      {/* Controlled Migration Modal (Phase 2D) */}
      <MigrationModal
        isOpen={isMigrationModalOpen}
        onClose={() => setIsMigrationModalOpen(false)}
        onMigrationComplete={handleMigrationComplete}
      />

      {/* Delete Period Confirmation Modal */}
      <ConfirmationModal
        isOpen={deletingPeriodId !== null}
        title="Delete Period Entry?"
        message="Are you sure you want to delete this recorded period? This will permanently remove its dates and recalculate your cycle statistics."
        confirmText="Delete Entry"
        confirmStyle="danger"
        onConfirm={confirmDeletePeriod}
        onCancel={() => setDeletingPeriodId(null)}
      />

      {/* Clear All Data Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmClearOpen}
        title="Delete All Your Data?"
        message="This will permanently delete all recorded periods, daily logs, notes, and cycle settings from your browser storage. This action cannot be undone."
        confirmText="Erase All Data"
        confirmStyle="danger"
        onConfirm={confirmClearAll}
        onCancel={() => setIsConfirmClearOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <SecurityProvider>
      <AppContent />
    </SecurityProvider>
  );
}
