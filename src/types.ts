/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FlowLevel = 'light' | 'medium' | 'heavy';

export type EnergyLevel = 'low' | 'normal' | 'high';

export type SymptomType =
  | 'Cramps'
  | 'Headache'
  | 'Back pain'
  | 'Bloating'
  | 'Breast tenderness'
  | 'Fatigue'
  | 'Acne'
  | 'Nausea'
  | 'Mood swings'
  | 'Cravings'
  | 'Insomnia'
  | 'Other';

export type MoodType =
  | 'Happy'
  | 'Calm'
  | 'Irritated'
  | 'Sad'
  | 'Anxious'
  | 'Tired'
  | 'Energetic';

export type CyclePhase =
  | 'menstrual'
  | 'follicular'
  | 'ovulation'
  | 'luteal'
  | 'unknown';

export interface PeriodEntry {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD or null if still ongoing
  flow: FlowLevel;
  symptoms: SymptomType[];
  mood?: MoodType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  isPeriodDay: boolean;
  flow?: FlowLevel;
  symptoms: SymptomType[];
  mood?: MoodType;
  energy?: EnergyLevel;
  notes?: string;
  updatedAt: string;
}

export type NotificationReminderMode = 'off' | 'silent' | 'sound';

export type ReminderTimingOption =
  | 'same_day'
  | '1_day_before'
  | '2_days_before'
  | '3_days_before';

export interface UserNotificationSettings {
  periodReminderMode?: NotificationReminderMode;
  reminderTiming?: ReminderTimingOption;
  lastDeliveredReminderHash?: string | null;
  lastDeliveredAt?: string | null;

  // Legacy/compatibility properties
  periodReminder?: boolean;
  expectedPeriodReminder?: boolean;
  fertileWindowReminder?: boolean;
  dailyTrackingReminder?: boolean;
}

export interface UserSettings {
  userName: string;
  defaultCycleLength: number; // in days, e.g. 28
  defaultPeriodDuration: number; // in days, e.g. 5
  hasCompletedOnboarding: boolean;
  notifications: UserNotificationSettings;
  activeProfileId: string;
}

export interface PredictedCycle {
  cycleNumber: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  ovulationDate: string; // YYYY-MM-DD
  fertileStart: string; // YYYY-MM-DD
  fertileEnd: string; // YYYY-MM-DD
}

export interface HistoricalCycle {
  id: string;
  startDate: string;
  endDate: string | null;
  durationDays: number;
  cycleLengthDays: number | null; // Days until next period started, or null if latest
  flow: FlowLevel;
  symptoms: SymptomType[];
}

export interface CycleCalculationResult {
  latestPeriod: PeriodEntry | null;
  currentCycleDay: number | null;
  daysUntilNextPeriod: number | null;
  nextPeriodStartDate: string | null;
  nextPeriodEndDate: string | null;
  estimatedOvulationDate: string | null;
  fertileWindow: {
    start: string;
    end: string;
  } | null;
  currentPhase: CyclePhase;
  phaseTitle: string;
  phaseDescription: string;
  averageCycleLength: number;
  averagePeriodDuration: number;
  isIrregular: boolean;
  irregularityMessage?: string;
  predictedCycles: PredictedCycle[];
  historicalCycles: HistoricalCycle[];
}

export interface CycleStatistics {
  totalCycles: number;
  averageCycleLength: number;
  averagePeriodDuration: number;
  shortestCycle: number;
  longestCycle: number;
  cycleVariationDays: number;
  mostCommonSymptoms: { symptom: SymptomType; count: number; percentage: number }[];
  moodDistribution: { mood: MoodType; count: number }[];
}

export type NavigationTab = 'home' | 'calendar' | 'history' | 'insights' | 'settings';
