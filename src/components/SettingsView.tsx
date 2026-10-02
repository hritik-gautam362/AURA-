/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  DailyLog,
  NotificationReminderMode,
  PeriodEntry,
  ReminderTimingOption,
  UserNotificationSettings,
  UserSettings,
} from '../types';
import { exportBackupJSON, parseAndValidateBackupJSON } from '../utils/storage';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendPrivacySafeNotification,
  BROWSER_NOTIFICATION_LIMITATIONS,
} from '../utils/notifications';
import {
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  CheckCircle,
  Download,
  Lock,
  RotateCcw,
  Shield,
  Trash2,
  Upload,
  User,
  Sparkles,
  Sliders,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface SettingsViewProps {
  settings: UserSettings;
  periods?: PeriodEntry[];
  dailyLogs?: Record<string, DailyLog>;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onClearAllData: () => void;
  onLoadDemoData: () => void;
  onRestartOnboarding: () => void;
  onLock?: () => void;
  hasLegacyData?: boolean;
  onOpenMigration?: () => void;
  onImportData?: (imported: {
    settings?: UserSettings;
    periods?: PeriodEntry[];
    dailyLogs?: Record<string, DailyLog>;
  }) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  periods,
  dailyLogs,
  onUpdateSettings,
  onClearAllData,
  onLoadDemoData,
  onRestartOnboarding,
  onLock,
  hasLegacyData,
  onOpenMigration,
  onImportData,
}) => {
  const [userName, setUserName] = useState(settings.userName);
  const [cycleLength, setCycleLength] = useState(settings.defaultCycleLength);
  const [periodDuration, setPeriodDuration] = useState(settings.defaultPeriodDuration);
  const [periodReminderMode, setPeriodReminderMode] = useState<NotificationReminderMode>(() => {
    return settings.notifications?.periodReminderMode ?? 'off';
  });
  const [reminderTiming, setReminderTiming] = useState<ReminderTimingOption>(() => {
    return settings.notifications?.reminderTiming ?? '1_day_before';
  });
  const [permissionPromptTarget, setPermissionPromptTarget] = useState<NotificationReminderMode | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    return getNotificationPermission();
  });
  const [notificationTestStatus, setNotificationTestStatus] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  useEffect(() => {
    if (settings.notifications) {
      setPeriodReminderMode(settings.notifications.periodReminderMode ?? 'off');
      setReminderTiming(settings.notifications.reminderTiming ?? '1_day_before');
    }
  }, [settings.notifications]);

  const handleSaveDefaults = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      userName: userName.trim() || 'Lovely',
      defaultCycleLength: Number(cycleLength) || 28,
      defaultPeriodDuration: Number(periodDuration) || 5,
      notifications: {
        ...settings.notifications,
        periodReminderMode,
        reminderTiming,
      },
    });
    setSaveSuccessMsg('Settings saved successfully!');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleSelectMode = (mode: NotificationReminderMode) => {
    setNotificationTestStatus('');
    if (mode === 'off') {
      setPeriodReminderMode('off');
      setPermissionPromptTarget(null);
      const updatedNotifications: UserNotificationSettings = {
        ...settings.notifications,
        periodReminderMode: 'off',
      };
      onUpdateSettings({
        ...settings,
        notifications: updatedNotifications,
      });
      return;
    }

    if (!isNotificationSupported()) {
      setNotificationTestStatus('Browser notifications are not supported by this browser environment.');
      return;
    }

    const currentPerm = getNotificationPermission();
    setNotificationPermission(currentPerm);

    if (currentPerm === 'granted') {
      setPeriodReminderMode(mode);
      setPermissionPromptTarget(null);
      const updatedNotifications: UserNotificationSettings = {
        ...settings.notifications,
        periodReminderMode: mode,
      };
      onUpdateSettings({
        ...settings,
        notifications: updatedNotifications,
      });
    } else if (currentPerm === 'denied') {
      setNotificationTestStatus(
        'Notifications are blocked by your browser settings. To enable reminders, please update site permissions in your browser.'
      );
    } else {
      // Default: show explicit user prompt before triggering browser permission dialog
      setPermissionPromptTarget(mode);
    }
  };

  const handleConfirmPermission = async () => {
    if (!permissionPromptTarget) return;
    const target = permissionPromptTarget;
    try {
      const perm = await requestNotificationPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        setPeriodReminderMode(target);
        setPermissionPromptTarget(null);
        const updatedNotifications: UserNotificationSettings = {
          ...settings.notifications,
          periodReminderMode: target,
        };
        onUpdateSettings({
          ...settings,
          notifications: updatedNotifications,
        });
        setNotificationTestStatus('Notifications enabled! Reminders will be delivered privately.');
      } else if (perm === 'denied') {
        setPermissionPromptTarget(null);
        setNotificationTestStatus(
          'Notifications are blocked by your browser. Please update permissions in your browser settings to enable reminders.'
        );
      } else {
        setPermissionPromptTarget(null);
      }
    } catch {
      setPermissionPromptTarget(null);
      setNotificationTestStatus('Could not request notification permissions.');
    }
  };

  const handleCancelPermission = () => {
    setPermissionPromptTarget(null);
  };

  const handleSelectTiming = (timing: ReminderTimingOption) => {
    setReminderTiming(timing);
    const updatedNotifications: UserNotificationSettings = {
      ...settings.notifications,
      reminderTiming: timing,
    };
    onUpdateSettings({
      ...settings,
      notifications: updatedNotifications,
    });
  };

  const handleSendTestNotification = async () => {
    setNotificationTestStatus('Sending test notification...');
    const result = await sendPrivacySafeNotification({
      mode: periodReminderMode === 'silent' ? 'silent' : 'sound',
      isTest: true,
    });
    if (result.success) {
      setNotificationTestStatus('Test notification sent successfully (Title: "Orienta reminder", Body: "This is a notification test.").');
    } else {
      setNotificationTestStatus(`Could not send test notification: ${result.error || 'Unknown error'}`);
    }
  };

  const handleExportData = () => {
    const json = exportBackupJSON(settings, periods || [], dailyLogs || {});
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cycle-data-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = parseAndValidateBackupJSON(content);
        if (result.success && result.data) {
          if (onImportData) {
            onImportData(result.data);
            setSaveSuccessMsg('Backup imported and securely encrypted in vault!');
            setTimeout(() => setSaveSuccessMsg(''), 4000);
          }
        } else {
          alert(result.message || 'Invalid backup file format.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div id="settings-view" className="space-y-8 max-w-3xl mx-auto">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#2B171B] font-serif">
          Settings & Preferences
        </h2>
        <p className="text-sm text-[#795B62] mt-1">
          Customize cycle baselines, reminders, and manage your private data
        </p>
      </div>

      {saveSuccessMsg && (
        <div className="p-3.5 bg-[#E8F5E9] border border-[#C8E6C9] rounded-2xl text-xs font-semibold text-[#2E7D32] flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Cycle Baselines & Personalization */}
      <div className="bg-white rounded-3xl p-6 border border-[#F5E6E8] shadow-xs space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFF0F4] text-[#8B0000] flex items-center justify-center">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#2B171B]">
              Cycle Baselines
            </h3>
            <p className="text-xs text-[#795B62]">
              Used for initial predictions until historical records establish your pattern
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveDefaults} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#795B62] uppercase tracking-wider">
                Preferred Name
              </label>
              <input
                id="settings-username-input"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Sarah"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#F3E5E8] bg-white text-sm text-[#2B171B] focus:outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#795B62] uppercase tracking-wider">
                Usual Cycle Length (Days)
              </label>
              <input
                id="settings-cycle-length-input"
                type="number"
                min={20}
                max={60}
                value={cycleLength}
                onChange={(e) => setCycleLength(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#F3E5E8] bg-white text-sm text-[#2B171B] focus:outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#795B62] uppercase tracking-wider">
                Usual Period Span (Days)
              </label>
              <input
                id="settings-period-duration-input"
                type="number"
                min={2}
                max={12}
                value={periodDuration}
                onChange={(e) => setPeriodDuration(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#F3E5E8] bg-white text-sm text-[#2B171B] focus:outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000]"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              id="save-settings-btn"
              className="px-5 py-2.5 rounded-xl bg-[#8B0000] text-white text-sm font-semibold hover:bg-[#6D0000] transition-colors shadow-xs"
            >
              Save Baselines
            </button>
          </div>
        </form>
      </div>

      {/* Privacy & Notifications Section */}
      <div
        id="privacy-notifications-section"
        className="bg-white rounded-3xl p-6 border border-[#F5E6E8] shadow-xs space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0F4] text-[#8B0000] flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2B171B]">
                Privacy & Notifications
              </h3>
              <p className="text-xs text-[#795B62]">
                Choose how Orienta should remind you.
              </p>
            </div>
          </div>

          {/* Browser Permission Status Badge */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {notificationPermission === 'granted' ? (
              <span
                id="notif-permission-badge-granted"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Notifications are enabled.</span>
              </span>
            ) : notificationPermission === 'denied' ? (
              <span
                id="notif-permission-badge-denied"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Notifications are blocked by your browser.</span>
              </span>
            ) : notificationPermission === 'unsupported' ? (
              <span
                id="notif-permission-badge-unsupported"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Browser notifications unavailable.</span>
              </span>
            ) : (
              <span
                id="notif-permission-badge-default"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F5F5F5] text-[#616161] border border-[#E0E0E0]"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Permission not requested.</span>
              </span>
            )}
          </div>
        </div>

        {/* Feedback message banner if test status exists */}
        {notificationTestStatus && (
          <div
            id="notif-status-banner"
            className="p-3 bg-[#FFF8FA] rounded-2xl border border-[#F5E6E8] text-xs text-[#795B62] flex items-start gap-2"
          >
            <Info className="w-4 h-4 text-[#8B0000] shrink-0 mt-0.5" />
            <span>{notificationTestStatus}</span>
          </div>
        )}

        {/* Explicit Permission Request Prompt */}
        {permissionPromptTarget && (
          <div
            id="notif-permission-prompt-card"
            className="p-4 sm:p-5 rounded-2xl bg-[#FFF0F4] border border-[#F8BBD0] space-y-3 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-white text-[#8B0000] flex items-center justify-center shrink-0 shadow-2xs">
                <Bell className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#8B0000]">
                  Allow notifications from Orienta?
                </h4>
                <p className="text-xs text-[#795B62] leading-relaxed">
                  Orienta will send gentle, privacy-safe wellness reminders. Reminder notifications will never reveal period dates, symptoms, or personal health info on your lock screen.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-1 pl-11">
              <button
                type="button"
                id="confirm-allow-notifications-btn"
                onClick={handleConfirmPermission}
                className="px-4 py-2 rounded-xl bg-[#8B0000] text-white text-xs font-semibold hover:bg-[#6D0000] transition-colors shadow-2xs"
              >
                Allow Notifications
              </button>
              <button
                type="button"
                id="cancel-allow-notifications-btn"
                onClick={handleCancelPermission}
                className="px-3.5 py-2 rounded-xl bg-white border border-[#F3E5E8] text-xs font-semibold text-[#795B62] hover:bg-[#FFF8FA] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Period Reminders Mode Selector */}
        <div className="space-y-2 pt-1">
          <label className="block text-xs font-semibold text-[#795B62] uppercase tracking-wider">
            Period reminders
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Off */}
            <button
              type="button"
              id="notif-mode-off"
              onClick={() => handleSelectMode('off')}
              className={`flex items-center justify-between sm:justify-center gap-2.5 p-3.5 rounded-2xl border text-sm font-semibold transition-all ${
                periodReminderMode === 'off'
                  ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-2xs'
                  : 'bg-[#FFF8FA] text-[#795B62] border-[#F5E6E8] hover:bg-[#FFF0F4] hover:text-[#2B171B]'
              }`}
            >
              <div className="flex items-center gap-2">
                <BellOff className="w-4 h-4" />
                <span>Off</span>
              </div>
              <span
                className={`w-2 h-2 rounded-full ${
                  periodReminderMode === 'off' ? 'bg-white' : 'bg-transparent'
                }`}
              />
            </button>

            {/* Silent */}
            <button
              type="button"
              id="notif-mode-silent"
              onClick={() => handleSelectMode('silent')}
              className={`flex items-center justify-between sm:justify-center gap-2.5 p-3.5 rounded-2xl border text-sm font-semibold transition-all ${
                periodReminderMode === 'silent'
                  ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-2xs'
                  : 'bg-[#FFF8FA] text-[#795B62] border-[#F5E6E8] hover:bg-[#FFF0F4] hover:text-[#2B171B]'
              }`}
            >
              <div className="flex items-center gap-2">
                <VolumeX className="w-4 h-4" />
                <span>Silent</span>
              </div>
              <span
                className={`w-2 h-2 rounded-full ${
                  periodReminderMode === 'silent' ? 'bg-white' : 'bg-transparent'
                }`}
              />
            </button>

            {/* On + Sound */}
            <button
              type="button"
              id="notif-mode-sound"
              onClick={() => handleSelectMode('sound')}
              className={`flex items-center justify-between sm:justify-center gap-2.5 p-3.5 rounded-2xl border text-sm font-semibold transition-all ${
                periodReminderMode === 'sound'
                  ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-2xs'
                  : 'bg-[#FFF8FA] text-[#795B62] border-[#F5E6E8] hover:bg-[#FFF0F4] hover:text-[#2B171B]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                <span>On + Sound</span>
              </div>
              <span
                className={`w-2 h-2 rounded-full ${
                  periodReminderMode === 'sound' ? 'bg-white' : 'bg-transparent'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Reminder Timing & Test Notification Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Reminder Timing */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#795B62] uppercase tracking-wider">
              Reminder timing
            </label>
            <div className="relative">
              <select
                id="notif-timing-select"
                value={reminderTiming}
                onChange={(e) => handleSelectTiming(e.target.value as ReminderTimingOption)}
                disabled={periodReminderMode === 'off'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#F3E5E8] bg-white text-sm text-[#2B171B] focus:outline-none focus:border-[#8B0000] disabled:bg-[#F9F7F8] disabled:text-[#A09094] disabled:cursor-not-allowed"
              >
                <option value="1_day_before">1 day before</option>
              </select>
            </div>
            <p className="text-[11px] text-[#A0888F]">
              Calculated automatically using your cycle history and baselines.
            </p>
          </div>

          {/* Test Notification Button */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#795B62] uppercase tracking-wider">
              Test Notification
            </label>
            <div>
              {notificationPermission === 'granted' ? (
                <button
                  type="button"
                  id="send-test-notification-btn"
                  onClick={handleSendTestNotification}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#F3E5E8] bg-[#FFF8FA] text-[#8B0000] text-xs font-semibold hover:bg-[#FFF0F4] active:scale-95 transition-all shadow-2xs flex items-center justify-center gap-2"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Test Notification</span>
                </button>
              ) : (
                <p className="text-xs text-[#A0888F] py-2.5">
                  Test notification is available once browser alerts are enabled.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Operating System Sound & Scheduling Limitations Notice */}
        <div className="p-3.5 rounded-2xl bg-[#FFF8FA] border border-[#F5E6E8] space-y-1.5 text-xs text-[#795B62]">
          <div className="flex items-center gap-1.5 font-semibold text-[#2B171B]">
            <Info className="w-3.5 h-3.5 text-[#8B0000]" />
            <span>Browser & System Alert Notes</span>
          </div>
          <p className="leading-relaxed">
            {BROWSER_NOTIFICATION_LIMITATIONS.soundControl}
          </p>
          <p className="leading-relaxed text-[11px] text-[#91757C]">
            {BROWSER_NOTIFICATION_LIMITATIONS.backgroundScheduling}
          </p>
        </div>
      </div>

      {/* Privacy Guarantee & Medical Disclaimer */}
      <div className="bg-white rounded-3xl p-6 border border-[#F5E6E8] shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFF0F4] text-[#8B0000] flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#2B171B]">
              Privacy & Local Storage
            </h3>
            <p className="text-xs text-[#795B62]">
              Your intimate health information stays solely on your device
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFF8FA] border border-[#F3E5E8] space-y-2 text-xs text-[#795B62] leading-relaxed">
          <p className="font-semibold text-[#2B171B]">
            Your Data Stays Private on This Device
          </p>
          <p>
            Your period dates, physical symptoms, notes, and cycle lengths are encrypted with AES-256-GCM and stored strictly in your browser's private encrypted vault (IndexedDB). No unencrypted health telemetry or cycle history is transmitted to external servers or persisted in plaintext.
          </p>
          <p className="pt-1 text-[11px] text-[#A88B92]">
            Disclaimer: This app provides estimates for informational tracking only and is not a clinical diagnostic or guaranteed contraception tool.
          </p>

          {hasLegacyData && onOpenMigration && (
            <div className="pt-3 border-t border-[#F5E6E8] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[#2B171B]">Legacy Storage Detected</span>
                <p className="text-[11px] text-[#795B62]">
                  Unencrypted legacy records were detected in your browser storage. You can securely transfer them to your encrypted vault.
                </p>
              </div>
              <button
                type="button"
                id="settings-migrate-data-btn"
                onClick={onOpenMigration}
                className="shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFF0F4] text-[#8B0000] border border-[#F3E5E8] text-xs font-semibold hover:bg-[#FCE4EC] transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Migrate Securely</span>
              </button>
            </div>
          )}

          {onLock && (
            <div className="pt-2 border-t border-[#F5E6E8] flex justify-end">
              <button
                type="button"
                id="settings-lock-vault-btn"
                onClick={onLock}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#8B0000] text-white text-xs font-semibold hover:bg-[#6D0000] transition-colors shadow-2xs"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Vault Now</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Data Management & Backup */}
      <div className="bg-white rounded-3xl p-6 border border-[#F5E6E8] shadow-xs space-y-4">
        <h3 className="text-base font-bold text-[#2B171B]">
          Data Management
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleExportData}
            id="export-data-btn"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-[#F3E5E8] bg-white text-[#2B171B] text-xs font-semibold hover:bg-[#FFF8FA] hover:border-[#8B0000] transition-colors"
          >
            <Download className="w-4 h-4 text-[#8B0000]" />
            Export My Data (JSON)
          </button>

          <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-[#F3E5E8] bg-white text-[#2B171B] text-xs font-semibold hover:bg-[#FFF8FA] hover:border-[#8B0000] transition-colors cursor-pointer">
            <Upload className="w-4 h-4 text-[#C2185B]" />
            <span>Import Backup (JSON)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>
        </div>

        <div className="pt-2 border-t border-[#F5E6E8] flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onLoadDemoData}
            className="text-xs font-semibold text-[#8B0000] hover:underline flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Load Sample Historical Cycles (Demo)
          </button>

          <button
            onClick={onRestartOnboarding}
            className="text-xs font-semibold text-[#795B62] hover:text-[#2B171B] flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Re-run Setup Walkthrough
          </button>

          <button
            onClick={onClearAllData}
            id="clear-all-data-btn"
            className="text-xs font-semibold text-[#B71C1C] hover:bg-[#FFF0F2] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete All My Data
          </button>
        </div>
      </div>
    </div>
  );
};
