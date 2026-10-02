/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DailyLog, PeriodEntry, UserSettings } from '../types';

export const DEFAULT_SETTINGS: UserSettings = {
  userName: 'Lovely',
  defaultCycleLength: 28,
  defaultPeriodDuration: 5,
  hasCompletedOnboarding: false,
  notifications: {
    periodReminderMode: 'off',
    reminderTiming: '1_day_before',
    lastDeliveredReminderHash: null,
    lastDeliveredAt: null,
    periodReminder: false,
    expectedPeriodReminder: false,
    fertileWindowReminder: false,
    dailyTrackingReminder: false,
  },
  activeProfileId: 'default',
};

/**
 * Exports in-memory decrypted health data to JSON for user backup download.
 * Does NOT read from or interact with localStorage.
 */
export function exportBackupJSON(
  settings: UserSettings,
  periods: PeriodEntry[],
  dailyLogs: Record<string, DailyLog>
): string {
  const exportData = {
    app: 'Orienta by FillFlow',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    settings,
    periods,
    dailyLogs,
  };
  return JSON.stringify(exportData, null, 2);
}

export interface ParsedBackupResult {
  success: boolean;
  message: string;
  data?: {
    settings?: UserSettings;
    periods?: PeriodEntry[];
    dailyLogs?: Record<string, DailyLog>;
  };
}

/**
 * Validates and parses a backup JSON string in memory.
 * Does NOT write to localStorage.
 */
export function parseAndValidateBackupJSON(jsonStr: string): ParsedBackupResult {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'Invalid backup file format: expected a JSON object.' };
    }
    if (!data.periods && !data.settings && !data.dailyLogs) {
      return { success: false, message: 'Invalid backup file format: missing health records.' };
    }

    const parsed: {
      settings?: UserSettings;
      periods?: PeriodEntry[];
      dailyLogs?: Record<string, DailyLog>;
    } = {};

    if (Array.isArray(data.periods)) {
      parsed.periods = data.periods;
    }
    if (data.settings && typeof data.settings === 'object') {
      parsed.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    }
    if (data.dailyLogs && typeof data.dailyLogs === 'object') {
      parsed.dailyLogs = data.dailyLogs;
    }

    return {
      success: true,
      message: 'Backup parsed successfully!',
      data: parsed,
    };
  } catch {
    return { success: false, message: 'Failed to parse backup JSON file.' };
  }
}

/**
 * Deprecated legacy fallbacks: Zero localStorage reads or writes.
 * All health data must be persisted via secureStorage.
 */
export function loadSettings(): UserSettings {
  return DEFAULT_SETTINGS;
}

export function saveSettings(_settings: UserSettings): void {
  // Production health data must be written to SecureStorage with an unlocked CryptoKey.
}

export function loadPeriods(): PeriodEntry[] {
  return [];
}

export function savePeriods(_periods: PeriodEntry[]): void {
  // Production health data must be written to SecureStorage with an unlocked CryptoKey.
}

export function loadDailyLogs(): Record<string, DailyLog> {
  return {};
}

export function saveDailyLogs(_logs: Record<string, DailyLog>): void {
  // Production health data must be written to SecureStorage with an unlocked CryptoKey.
}

export function clearAllData(): void {
  // Production health data must be deleted via secureStorage.clearAllSecureData().
}

/**
 * Generates sample realistic historical data if user wants to test
 * multi-cycle history and statistical trends (September 2026 anchor)
 */
export function getSampleDemoData(): { periods: PeriodEntry[]; dailyLogs: Record<string, DailyLog> } {
  const periods: PeriodEntry[] = [
    {
      id: 'demo-cycle-1',
      startDate: '2026-09-02',
      endDate: '2026-09-06',
      flow: 'medium',
      symptoms: ['Cramps', 'Fatigue', 'Bloating'],
      mood: 'Tired',
      notes: 'First day had mild cramps, subsided by day 3.',
      createdAt: '2026-09-02T08:00:00.000Z',
      updatedAt: '2026-09-06T19:00:00.000Z',
    },
    {
      id: 'demo-cycle-2',
      startDate: '2026-08-04',
      endDate: '2026-08-09',
      flow: 'heavy',
      symptoms: ['Cramps', 'Headache', 'Back pain'],
      mood: 'Irritated',
      notes: 'Heavy flow day 2.',
      createdAt: '2026-08-04T08:00:00.000Z',
      updatedAt: '2026-08-09T19:00:00.000Z',
    },
    {
      id: 'demo-cycle-3',
      startDate: '2026-07-06',
      endDate: '2026-07-11',
      flow: 'medium',
      symptoms: ['Bloating', 'Breast tenderness', 'Fatigue'],
      mood: 'Calm',
      notes: 'Drank chamomile tea, felt relaxed.',
      createdAt: '2026-07-06T08:00:00.000Z',
      updatedAt: '2026-07-11T19:00:00.000Z',
    },
    {
      id: 'demo-cycle-4',
      startDate: '2026-06-08',
      endDate: '2026-06-12',
      flow: 'light',
      symptoms: ['Cramps', 'Mood swings'],
      mood: 'Anxious',
      notes: 'Slightly shorter period this month.',
      createdAt: '2026-06-08T08:00:00.000Z',
      updatedAt: '2026-06-12T19:00:00.000Z',
    },
  ];

  const dailyLogs: Record<string, DailyLog> = {
    '2026-09-15': {
      date: '2026-09-15',
      isPeriodDay: false,
      symptoms: ['Fatigue'],
      mood: 'Calm',
      energy: 'normal',
      notes: 'Feeling balanced today, mild workout in morning.',
      updatedAt: '2026-09-15T09:00:00.000Z',
    },
    '2026-09-14': {
      date: '2026-09-14',
      isPeriodDay: false,
      symptoms: [],
      mood: 'Happy',
      energy: 'high',
      notes: 'Productive day at work.',
      updatedAt: '2026-09-14T20:00:00.000Z',
    },
    '2026-09-02': {
      date: '2026-09-02',
      isPeriodDay: true,
      flow: 'heavy',
      symptoms: ['Cramps', 'Back pain'],
      mood: 'Tired',
      energy: 'low',
      notes: 'Period started morning.',
      updatedAt: '2026-09-02T12:00:00.000Z',
    },
  };

  return { periods, dailyLogs };
}
