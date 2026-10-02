/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CycleCalculationResult,
  CyclePhase,
  CycleStatistics,
  DailyLog,
  HistoricalCycle,
  PeriodEntry,
  PredictedCycle,
  SymptomType,
  MoodType,
  UserSettings,
} from '../types';

// ==========================================
// Safe Date Helper Functions (No Timezone Drifts)
// ==========================================

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(): string {
  // Use today's date in local calendar
  const now = new Date();
  return formatLocalDate(now);
}

export function addDays(dateStr: string, days: number): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

/**
 * Returns integer days between dateA and dateB (dateB - dateA)
 */
export function diffInDays(startStr: string, endStr: string): number {
  const start = parseLocalDate(startStr);
  const end = parseLocalDate(endStr);
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDisplayDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', options || { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDisplayMonth(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ==========================================
// Core Cycle Engine Functions
// ==========================================

/**
 * Calculate current cycle day relative to latest period start date
 * Cycle Day = current date - latest period start date + 1
 */
export function calculateCycleDay(currentDateStr: string, latestStartDateStr: string): number {
  const diff = diffInDays(latestStartDateStr, currentDateStr);
  return diff + 1;
}

/**
 * Calculate average cycle length from historical period entries.
 * Sorts periods chronologically and calculates gaps between start dates.
 * Uses weighted average giving recent cycles more weight.
 */
export function calculateAverageCycleLength(
  periods: PeriodEntry[],
  defaultCycleLength: number = 28
): { average: number; isIrregular: boolean; variation: number } {
  if (periods.length < 2) {
    return { average: defaultCycleLength, isIrregular: false, variation: 0 };
  }

  // Sort chronological (oldest to newest)
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const cycleLengths: number[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const days = diffInDays(sorted[i].startDate, sorted[i + 1].startDate);
    // Ignore absurd gaps (e.g. over 80 days or negative)
    if (days >= 18 && days <= 65) {
      cycleLengths.push(days);
    }
  }

  if (cycleLengths.length === 0) {
    return { average: defaultCycleLength, isIrregular: false, variation: 0 };
  }

  // Weighted average: more weight to recent cycles
  let weightedSum = 0;
  let totalWeights = 0;
  for (let i = 0; i < cycleLengths.length; i++) {
    const weight = i + 1; // Later indices are more recent
    weightedSum += cycleLengths[i] * weight;
    totalWeights += weight;
  }

  const rawAverage = weightedSum / totalWeights;
  const roundedAverage = Math.round(rawAverage * 10) / 10;

  // Measure variation (standard deviation or min-max spread)
  const min = Math.min(...cycleLengths);
  const max = Math.max(...cycleLengths);
  const variation = Math.round(((max - min) / 2) * 10) / 10;
  const isIrregular = variation >= 4.5 || (cycleLengths.length >= 3 && variation >= 4);

  return { average: Math.round(roundedAverage), isIrregular, variation };
}

/**
 * Calculate average duration of bleeding
 */
export function calculateAveragePeriodDuration(
  periods: PeriodEntry[],
  defaultDuration: number = 5
): number {
  const completedDurations: number[] = [];

  for (const p of periods) {
    if (p.endDate) {
      const dur = diffInDays(p.startDate, p.endDate) + 1;
      if (dur >= 1 && dur <= 14) {
        completedDurations.push(dur);
      }
    }
  }

  if (completedDurations.length === 0) {
    return defaultDuration;
  }

  const sum = completedDurations.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / completedDurations.length);
}

/**
 * Next period calculation:
 * Expected next period = latest period start date + estimated cycle length.
 */
export function calculateNextPeriod(
  latestStartDate: string,
  estimatedCycleLength: number,
  estimatedPeriodDuration: number
): { startDate: string; endDate: string } {
  const startDate = addDays(latestStartDate, estimatedCycleLength);
  const endDate = addDays(startDate, estimatedPeriodDuration - 1);
  return { startDate, endDate };
}

/**
 * Ovulation estimate:
 * Estimated ovulation ≈ next expected period date - 14 days.
 */
export function calculateOvulation(nextExpectedPeriodStart: string): string {
  return addDays(nextExpectedPeriodStart, -14);
}

/**
 * Fertile window:
 * Approximately 5 days before ovulation through 1 day after ovulation.
 */
export function calculateFertileWindow(ovulationDate: string): { start: string; end: string } {
  return {
    start: addDays(ovulationDate, -5),
    end: addDays(ovulationDate, 1),
  };
}

/**
 * Determine cycle phase for current cycle day
 */
export function calculateCyclePhase(
  cycleDay: number,
  periodDuration: number,
  cycleLength: number
): { phase: CyclePhase; title: string; description: string } {
  const ovulationDay = Math.max(1, cycleLength - 14);
  const fertileStartDay = Math.max(1, ovulationDay - 5);
  const fertileEndDay = ovulationDay + 1;

  if (cycleDay <= periodDuration && cycleDay >= 1) {
    return {
      phase: 'menstrual',
      title: 'Menstrual Phase',
      description: 'Your period is currently being tracked. Rest, stay hydrated, and take gentle care of yourself.',
    };
  }

  if (cycleDay < fertileStartDay) {
    return {
      phase: 'follicular',
      title: 'Follicular Phase',
      description: 'Your body is preparing for ovulation. Estrogen is rising, often bringing higher focus and energy.',
    };
  }

  if (cycleDay >= fertileStartDay && cycleDay <= fertileEndDay) {
    const isExactOvulation = cycleDay === ovulationDay;
    return {
      phase: 'ovulation',
      title: isExactOvulation ? 'Estimated Ovulation' : 'Fertile Window',
      description: isExactOvulation
        ? 'Estimated peak ovulation day. High chance of conception.'
        : 'Your fertile window. Probability of conception is elevated.',
    };
  }

  if (cycleDay > fertileEndDay) {
    return {
      phase: 'luteal',
      title: 'Luteal Phase',
      description: 'Progesterone levels rise. You may notice subtle mood shifts, cravings, or natural bodily wind-down.',
    };
  }

  return {
    phase: 'unknown',
    title: 'Cycle Tracking',
    description: 'Track daily symptoms to keep predictions personalized.',
  };
}

/**
 * Generate forward predicted cycles (e.g. next 3-4 months)
 */
export function generatePredictedCycles(
  latestStartDate: string,
  cycleLength: number,
  periodDuration: number,
  count: number = 3
): PredictedCycle[] {
  const predicted: PredictedCycle[] = [];
  let currentStart = latestStartDate;

  for (let i = 1; i <= count; i++) {
    const nextStart = addDays(currentStart, cycleLength);
    const nextEnd = addDays(nextStart, periodDuration - 1);
    const ovulation = calculateOvulation(nextStart);
    const fertile = calculateFertileWindow(ovulation);

    predicted.push({
      cycleNumber: i,
      startDate: nextStart,
      endDate: nextEnd,
      ovulationDate: ovulation,
      fertileStart: fertile.start,
      fertileEnd: fertile.end,
    });

    currentStart = nextStart;
  }

  return predicted;
}

/**
 * Build complete cycle calculation results
 */
export function calculateAllCycleData(
  periods: PeriodEntry[],
  settings: UserSettings,
  todayStr: string = getTodayDateString()
): CycleCalculationResult {
  if (periods.length === 0) {
    return {
      latestPeriod: null,
      currentCycleDay: null,
      daysUntilNextPeriod: null,
      nextPeriodStartDate: null,
      nextPeriodEndDate: null,
      estimatedOvulationDate: null,
      fertileWindow: null,
      currentPhase: 'unknown',
      phaseTitle: 'Start Your Cycle Journey',
      phaseDescription: 'Log your first period to unlock personalized cycle insights.',
      averageCycleLength: settings.defaultCycleLength,
      averagePeriodDuration: settings.defaultPeriodDuration,
      isIrregular: false,
      predictedCycles: [],
      historicalCycles: [],
    };
  }

  // Sort periods reverse chronological (newest first)
  const sortedPeriods = [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const latestPeriod = sortedPeriods[0];

  const { average: avgCycleLength, isIrregular, variation } = calculateAverageCycleLength(
    periods,
    settings.defaultCycleLength
  );
  const avgPeriodDuration = calculateAveragePeriodDuration(periods, settings.defaultPeriodDuration);

  // Compute current cycle day
  const currentCycleDay = calculateCycleDay(todayStr, latestPeriod.startDate);

  // Expected next period
  const nextPeriod = calculateNextPeriod(latestPeriod.startDate, avgCycleLength, avgPeriodDuration);
  const daysUntilNextPeriod = diffInDays(todayStr, nextPeriod.startDate);

  // Ovulation & fertile window of CURRENT cycle
  const currentOvulationDate = calculateOvulation(nextPeriod.startDate);
  const currentFertileWindow = calculateFertileWindow(currentOvulationDate);

  // Current Phase
  const effectivePeriodDuration = latestPeriod.endDate
    ? Math.max(1, diffInDays(latestPeriod.startDate, latestPeriod.endDate) + 1)
    : avgPeriodDuration;

  const { phase, title, description } = calculateCyclePhase(
    currentCycleDay,
    effectivePeriodDuration,
    avgCycleLength
  );

  // Predict future cycles
  const predictedCycles = generatePredictedCycles(latestPeriod.startDate, avgCycleLength, avgPeriodDuration, 4);

  // Build historical cycles structure
  const historicalCycles: HistoricalCycle[] = [];
  const chronological = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));

  for (let i = 0; i < chronological.length; i++) {
    const p = chronological[i];
    const durationDays = p.endDate
      ? Math.max(1, diffInDays(p.startDate, p.endDate) + 1)
      : avgPeriodDuration;

    let cycleLengthDays: number | null = null;
    if (i < chronological.length - 1) {
      cycleLengthDays = diffInDays(p.startDate, chronological[i + 1].startDate);
    }

    historicalCycles.unshift({
      id: p.id,
      startDate: p.startDate,
      endDate: p.endDate,
      durationDays,
      cycleLengthDays,
      flow: p.flow,
      symptoms: p.symptoms,
    });
  }

  let irregularityMessage: string | undefined = undefined;
  if (isIrregular) {
    irregularityMessage = `Your recent cycles vary by approximately ±${Math.round(variation)} days. Predictions are estimates and may shift.`;
  }

  return {
    latestPeriod,
    currentCycleDay: currentCycleDay > 0 ? currentCycleDay : null,
    daysUntilNextPeriod,
    nextPeriodStartDate: nextPeriod.startDate,
    nextPeriodEndDate: nextPeriod.endDate,
    estimatedOvulationDate: currentOvulationDate,
    fertileWindow: currentFertileWindow,
    currentPhase: phase,
    phaseTitle: title,
    phaseDescription: description,
    averageCycleLength: avgCycleLength,
    averagePeriodDuration: avgPeriodDuration,
    isIrregular,
    irregularityMessage,
    predictedCycles,
    historicalCycles,
  };
}

/**
 * Calculate summary statistics for the history and insights pages
 */
export function calculateCycleStatistics(
  periods: PeriodEntry[],
  dailyLogs: Record<string, DailyLog>,
  settings: UserSettings
): CycleStatistics {
  const { average: avgCycleLength, variation } = calculateAverageCycleLength(
    periods,
    settings.defaultCycleLength
  );
  const avgPeriodDuration = calculateAveragePeriodDuration(periods, settings.defaultPeriodDuration);

  // Compute cycle lengths
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const validCycleLengths: number[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const days = diffInDays(sorted[i].startDate, sorted[i + 1].startDate);
    if (days >= 18 && days <= 65) {
      validCycleLengths.push(days);
    }
  }

  const shortestCycle = validCycleLengths.length > 0 ? Math.min(...validCycleLengths) : avgCycleLength;
  const longestCycle = validCycleLengths.length > 0 ? Math.max(...validCycleLengths) : avgCycleLength;

  // Aggregate symptoms across periods and daily logs
  const symptomCounts: Record<string, number> = {};
  let totalSymptomInstances = 0;

  // From period records
  for (const p of periods) {
    for (const sym of p.symptoms) {
      symptomCounts[sym] = (symptomCounts[sym] || 0) + 1;
      totalSymptomInstances++;
    }
  }

  // From daily logs
  for (const log of Object.values(dailyLogs)) {
    for (const sym of log.symptoms) {
      // Avoid double counting if logged on same period date?
      symptomCounts[sym] = (symptomCounts[sym] || 0) + 1;
      totalSymptomInstances++;
    }
  }

  const mostCommonSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([symptom, count]) => ({
      symptom: symptom as SymptomType,
      count,
      percentage: totalSymptomInstances > 0 ? Math.round((count / totalSymptomInstances) * 100) : 0,
    }));

  // Mood distribution
  const moodCounts: Record<string, number> = {};
  for (const log of Object.values(dailyLogs)) {
    if (log.mood) {
      moodCounts[log.mood] = (moodCounts[log.mood] || 0) + 1;
    }
  }
  for (const p of periods) {
    if (p.mood) {
      moodCounts[p.mood] = (moodCounts[p.mood] || 0) + 1;
    }
  }

  const moodDistribution = Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([mood, count]) => ({
      mood: mood as MoodType,
      count,
    }));

  return {
    totalCycles: periods.length,
    averageCycleLength: avgCycleLength,
    averagePeriodDuration: avgPeriodDuration,
    shortestCycle,
    longestCycle,
    cycleVariationDays: Math.round(variation),
    mostCommonSymptoms,
    moodDistribution,
  };
}

/**
 * Check if a given date falls in any logged period
 */
export function isDateInLoggedPeriod(dateStr: string, periods: PeriodEntry[]): boolean {
  for (const p of periods) {
    if (p.startDate === dateStr) return true;
    if (p.endDate) {
      if (dateStr >= p.startDate && dateStr <= p.endDate) return true;
    } else {
      // Ongoing period: check within reasonable days (e.g. up to 10 days)
      const diff = diffInDays(p.startDate, dateStr);
      if (diff >= 0 && diff < 8) return true;
    }
  }
  return false;
}

/**
 * Check if a date is predicted period
 */
export function isDateInPredictedPeriod(dateStr: string, predictedCycles: PredictedCycle[]): boolean {
  for (const pred of predictedCycles) {
    if (dateStr >= pred.startDate && dateStr <= pred.endDate) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a date is in fertile window
 */
export function isDateInFertileWindow(
  dateStr: string,
  calcResult: CycleCalculationResult
): { isFertile: boolean; isOvulation: boolean } {
  // Check current cycle's fertile window
  if (calcResult.fertileWindow) {
    if (dateStr >= calcResult.fertileWindow.start && dateStr <= calcResult.fertileWindow.end) {
      return {
        isFertile: true,
        isOvulation: dateStr === calcResult.estimatedOvulationDate,
      };
    }
  }

  // Check predicted future cycles
  for (const pred of calcResult.predictedCycles) {
    if (dateStr >= pred.fertileStart && dateStr <= pred.fertileEnd) {
      return {
        isFertile: true,
        isOvulation: dateStr === pred.ovulationDate,
      };
    }
  }

  return { isFertile: false, isOvulation: false };
}
