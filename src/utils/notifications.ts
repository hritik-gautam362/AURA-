/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CycleCalculationResult,
  NotificationReminderMode,
  ReminderTimingOption,
  UserSettings,
} from '../types';

/**
 * Standard privacy-safe notification strings.
 * CRITICAL REQUIREMENT: These strings NEVER contain sensitive health details,
 * dates, symptom names, ovulation dates, or cycle phases.
 */
export const PRIVACY_SAFE_NOTIFICATION_COPY = Object.freeze({
  REMINDER: {
    title: 'Orienta reminder',
    body: 'You have a private wellness reminder.',
  },
  REMINDER_ALT: {
    title: 'A gentle reminder',
    body: 'Open Orienta to view your reminder.',
  },
  TEST: {
    title: 'Orienta reminder',
    body: 'This is a notification test.',
  },
});

/**
 * Technical documentation regarding web notification sound and platform behavior.
 */
export const BROWSER_NOTIFICATION_LIMITATIONS = Object.freeze({
  soundControl:
    'Web browsers cannot universally override the host operating system sound, Focus Assist, or Do Not Disturb settings. "Silent" instructs the browser not to emit audio, while "On + Sound" requests standard alert behavior subject to user OS preferences.',
  backgroundScheduling:
    'Client-side web applications without a push server cannot execute arbitrary future local alarms when completely closed on platforms lacking the Web Periodic Background Sync or Notification Triggers APIs. Reminders are evaluated when Orienta is opened or resumed.',
});

/**
 * Check if the browser environment supports the Web Notification API.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Return current Notification permission or 'unsupported' if unavailable.
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Request notification permission after an explicit user interaction.
 * Never prompts if permission has already been denied.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  // If already denied, do not repeatedly trigger rejected prompts
  if (Notification.permission === 'denied') {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    return 'default';
  }
}

/**
 * Generate a deterministic, non-reversible SHA-256 hash for duplicate prevention.
 * Ensures the actual cycle/period dates are never stored in plaintext notification metadata.
 */
export async function computeReminderHash(
  targetDateStr: string,
  reminderType: string = 'period'
): Promise<string> {
  const payload = `aura-notification:${reminderType}:${targetDateStr}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback below
    }
  }

  // Deterministic fallback hash for test runners or environments lacking subtle crypto
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = (hash * 0x01000193) >>> 0;
  }
  return `hash_${hash.toString(16).padStart(8, '0')}`;
}

/**
 * Map reminder timing option to days until expected period.
 */
export function getTimingDaysThreshold(timing: ReminderTimingOption): number {
  switch (timing) {
    case 'same_day':
      return 0;
    case '1_day_before':
      return 1;
    case '2_days_before':
      return 2;
    case '3_days_before':
      return 3;
    default:
      return 1;
  }
}

export interface ReminderEvaluationResult {
  due: boolean;
  targetDate: string | null;
  targetDateHash: string | null;
  reason: string;
}

/**
 * Evaluates whether a period reminder should be triggered based on current
 * cycle predictions and encrypted user settings.
 *
 * Rules:
 * - Fails safe (due: false) if notifications are 'off'.
 * - Requires sufficient cycle prediction data (fails safe if no periods logged).
 * - Matches target timing (e.g. exactly 1 day before expected period).
 * - Enforces duplicate prevention: rejects if targetDateHash matches previously delivered hash.
 */
export async function evaluatePeriodReminder(
  calcResult: CycleCalculationResult,
  settings: UserSettings
): Promise<ReminderEvaluationResult> {
  const mode = settings.notifications?.periodReminderMode ?? 'off';
  if (mode === 'off') {
    return {
      due: false,
      targetDate: null,
      targetDateHash: null,
      reason: 'Notification reminders are set to Off.',
    };
  }

  // Ensure sufficient cycle data exists
  if (!calcResult.latestPeriod || !calcResult.nextPeriodStartDate || calcResult.daysUntilNextPeriod === null) {
    return {
      due: false,
      targetDate: null,
      targetDateHash: null,
      reason: 'Insufficient cycle data to calculate period prediction.',
    };
  }

  const timing = settings.notifications?.reminderTiming ?? '1_day_before';
  const targetThresholdDays = getTimingDaysThreshold(timing);

  // Due when current daysUntilNextPeriod matches the configured threshold
  if (calcResult.daysUntilNextPeriod !== targetThresholdDays) {
    return {
      due: false,
      targetDate: null,
      targetDateHash: null,
      reason: `Reminder not due: ${calcResult.daysUntilNextPeriod} days remaining (threshold: ${targetThresholdDays}).`,
    };
  }

  const targetDate = calcResult.nextPeriodStartDate;
  const targetDateHash = await computeReminderHash(targetDate, 'period');

  // Duplicate prevention check
  if (settings.notifications?.lastDeliveredReminderHash === targetDateHash) {
    return {
      due: false,
      targetDate: null,
      targetDateHash,
      reason: 'Reminder has already been delivered for this upcoming cycle.',
    };
  }

  return {
    due: true,
    targetDate,
    targetDateHash,
    reason: 'Reminder is due and ready for dispatch.',
  };
}

export interface DispatchNotificationOptions {
  mode: NotificationReminderMode;
  isTest?: boolean;
  tag?: string;
}

/**
 * Dispatch a strictly privacy-safe browser notification.
 * Prioritizes ServiceWorkerRegistration.showNotification() for PWA compatibility,
 * falling back to new Notification() where supported.
 */
export async function sendPrivacySafeNotification(
  options: DispatchNotificationOptions
): Promise<{ success: boolean; delivered: boolean; error?: string }> {
  if (!isNotificationSupported()) {
    return { success: false, delivered: false, error: 'Notification API unavailable.' };
  }

  if (Notification.permission !== 'granted') {
    return { success: false, delivered: false, error: 'Notification permission not granted.' };
  }

  if (options.mode === 'off') {
    return { success: false, delivered: false, error: 'Notifications are turned off.' };
  }

  const copy = options.isTest
    ? PRIVACY_SAFE_NOTIFICATION_COPY.TEST
    : PRIVACY_SAFE_NOTIFICATION_COPY.REMINDER;

  const isSilent = options.mode === 'silent';
  const notificationOptions: NotificationOptions = {
    body: copy.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon.svg',
    tag: options.tag ?? (options.isTest ? 'aura-test-reminder' : 'aura-wellness-reminder'),
    silent: isSilent,
  };

  try {
    // 1. Try ServiceWorkerRegistration if active
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && typeof registration.showNotification === 'function') {
          await registration.showNotification(copy.title, notificationOptions);
          return { success: true, delivered: true };
        }
      } catch {
        // Fallback to standard Notification constructor
      }
    }

    // 2. Fallback to standard Window Notification
    const notif = new Notification(copy.title, notificationOptions);
    notif.onclick = () => {
      try {
        window.focus();
      } catch {}
      notif.close();
    };

    return { success: true, delivered: true };
  } catch (err) {
    return {
      success: false,
      delivered: false,
      error: err instanceof Error ? err.message : 'Failed to display notification.',
    };
  }
}
