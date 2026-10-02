/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  CycleCalculationResult,
  CycleStatistics,
  DailyLog,
  PeriodEntry,
  UserSettings,
} from '../types';
import { CycleCard } from './CycleCard';
import { CalendarView } from './CalendarView';
import { getTodayDateString, formatDisplayDate } from '../utils/cycleCalculations';
import {
  Heart,
  Calendar as CalendarIcon,
  Sparkles,
  Droplets,
  Plus,
  Smile,
  Activity,
  ArrowRight,
  Sun,
  Moon,
  Flame,
  Bell,
  BellRing,
} from 'lucide-react';

interface HomeDashboardViewProps {
  settings: UserSettings;
  periods: PeriodEntry[];
  dailyLogs: Record<string, DailyLog>;
  calcResult: CycleCalculationResult;
  stats: CycleStatistics;
  onOpenLogPeriod: () => void;
  onOpenLogToday: () => void;
  onSelectDate: (dateStr: string) => void;
  onNavigateToTab: (tab: any) => void;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({
  settings,
  periods,
  dailyLogs,
  calcResult,
  stats,
  onOpenLogPeriod,
  onOpenLogToday,
  onSelectDate,
  onNavigateToTab,
}) => {
  const todayStr = getTodayDateString();
  const todayLog = dailyLogs[todayStr];

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hours = new Date().getHours();
    let timeGreeting = 'Good morning';
    if (hours >= 12 && hours < 17) {
      timeGreeting = 'Good afternoon';
    } else if (hours >= 17) {
      timeGreeting = 'Good evening';
    }

    if (settings.userName) {
      return `${timeGreeting}, ${settings.userName} ❤️`;
    }
    return `${timeGreeting} ❤️`;
  };

  return (
    <div id="home-dashboard" className="space-y-8">
      {/* Top Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2B171B] font-serif">
            {getGreeting()}
          </h1>
          <p className="text-xs sm:text-sm text-[#795B62] mt-0.5">
            {formatDisplayDate(todayStr, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Quick Date pill */}
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#F5E6E8] text-xs font-semibold text-[#8B0000] shadow-2xs">
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>Cycle Status: {calcResult.phaseTitle}</span>
        </div>
      </div>

      {/* Main Cycle Card with Circular Gauge */}
      <CycleCard
        calcResult={calcResult}
        onOpenLogPeriod={onOpenLogPeriod}
        onOpenLogToday={onOpenLogToday}
      />

      {/* 2. Quick Log Actions & 3. Today's Tracking */}
      <div
        id="todays-tracking-section"
        className="bg-white rounded-3xl p-5 sm:p-6 border border-[#F5E6E8] shadow-xs space-y-4 card-fade-in"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FFF0F4] text-[#8B0000] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2B171B] font-serif">
                Today's Check-in
              </h3>
              <p className="text-xs text-[#795B62]">
                {todayLog
                  ? 'Your log is recorded for today'
                  : 'Check in with how your body feels today'}
              </p>
            </div>
          </div>

          <button
            id="open-today-checkin-btn"
            onClick={onOpenLogToday}
            aria-label={todayLog ? 'Edit Check-in' : '+ Check-in Today'}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#8B0000] hover:text-[#6D0000] bg-[#FFF0F4] hover:bg-[#FCE4EC] px-3.5 py-2 rounded-xl transition-colors btn-press min-h-[44px]"
          >
            <span>{todayLog ? 'Edit Check-in' : '+ Check-in Today'}</span>
          </button>
        </div>

        {/* Today's snapshot chips */}
        {todayLog ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {todayLog.isPeriodDay && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#8B0000] text-white">
                <Droplets className="w-3.5 h-3.5" />
                Period Day ({todayLog.flow || 'medium'})
              </span>
            )}
            {todayLog.mood && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#FFF0F4] text-[#C2185B] border border-[#F8BBD0]">
                <Smile className="w-3.5 h-3.5" />
                Mood: {todayLog.mood}
              </span>
            )}
            {todayLog.energy && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#FFF8FA] text-[#795B62] border border-[#F3E5E8]">
                Energy: {todayLog.energy}
              </span>
            )}
            {todayLog.symptoms &&
              todayLog.symptoms.map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#FCE4EC] text-[#8B0000]"
                >
                  {s}
                </span>
              ))}
            {todayLog.notes && (
              <p className="w-full text-xs text-[#795B62] italic pt-1 pl-1">
                "{todayLog.notes}"
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <button
              onClick={onOpenLogToday}
              aria-label="Log Flow"
              className="p-3.5 rounded-2xl bg-[#FFF8FA] border border-[#F5E6E8] hover:border-[#8B0000] text-left transition-all btn-press group min-h-[44px]"
            >
              <Droplets className="w-4 h-4 text-[#8B0000] mb-1 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-[#2B171B]">Log Flow</div>
              <div className="text-[11px] text-[#795B62]">Spotting / bleed</div>
            </button>

            <button
              onClick={onOpenLogToday}
              aria-label="Log Symptoms"
              className="p-3.5 rounded-2xl bg-[#FFF8FA] border border-[#F5E6E8] hover:border-[#8B0000] text-left transition-all btn-press group min-h-[44px]"
            >
              <Flame className="w-4 h-4 text-[#C2185B] mb-1 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-[#2B171B]">Log Symptoms</div>
              <div className="text-[11px] text-[#795B62]">Cramps, bloating...</div>
            </button>

            <button
              onClick={onOpenLogToday}
              aria-label="Log Mood"
              className="p-3.5 rounded-2xl bg-[#FFF8FA] border border-[#F5E6E8] hover:border-[#8B0000] text-left transition-all btn-press group min-h-[44px]"
            >
              <Smile className="w-4 h-4 text-[#E91E63] mb-1 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-[#2B171B]">Log Mood</div>
              <div className="text-[11px] text-[#795B62]">Calm, happy, tired</div>
            </button>

            <button
              onClick={onOpenLogToday}
              aria-label="Add Note"
              className="p-3.5 rounded-2xl bg-[#FFF8FA] border border-[#F5E6E8] hover:border-[#8B0000] text-left transition-all btn-press group min-h-[44px]"
            >
              <Sparkles className="w-4 h-4 text-[#795B62] mb-1 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-[#2B171B]">Add Note</div>
              <div className="text-[11px] text-[#795B62]">Reflections & health</div>
            </button>
          </div>
        )}
      </div>

      {/* 4. Upcoming Reminder Status */}
      <div
        id="dashboard-upcoming-reminder-card"
        className="bg-white rounded-3xl p-5 border border-[#F5E6E8] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 card-fade-in"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
            settings.notifications?.periodReminderMode && settings.notifications.periodReminderMode !== 'off'
              ? 'bg-[#FFF0F4] text-[#8B0000]'
              : 'bg-[#FFF8FA] text-[#795B62]'
          }`}>
            {settings.notifications?.periodReminderMode && settings.notifications.periodReminderMode !== 'off' ? (
              <BellRing className="w-4 h-4 text-[#8B0000]" />
            ) : (
              <Bell className="w-4 h-4 text-[#795B62]" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#2B171B] font-serif">
              {settings.notifications?.periodReminderMode && settings.notifications.periodReminderMode !== 'off'
                ? 'Discreet Reminder Active'
                : 'Private Period Reminders'}
            </h4>
            <p className="text-xs text-[#795B62] mt-0.5">
              {settings.notifications?.periodReminderMode && settings.notifications.periodReminderMode !== 'off'
                ? `Discreet 1-day notification active (${settings.notifications.periodReminderMode === 'sound' ? 'On + Sound' : 'Silent'}).`
                : 'Get a private, quiet reminder 1 day before your expected period.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigateToTab('settings')}
          aria-label="Manage Notification Settings"
          className="self-stretch sm:self-center px-4 py-2.5 rounded-xl bg-[#FFF8FA] text-[#8B0000] hover:bg-[#FFF0F4] border border-[#F3E5E8] text-xs font-semibold transition-colors btn-press text-center min-h-[44px] flex items-center justify-center"
        >
          {settings.notifications?.periodReminderMode && settings.notifications.periodReminderMode !== 'off'
            ? 'Manage'
            : 'Configure'}
        </button>
      </div>

      {/* 5. Insights Preview */}
      <div
        id="dashboard-insights-preview"
        className="p-5 sm:p-6 bg-white rounded-3xl border border-[#F5E6E8] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-fade-in"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8B0000]">
              Insights Preview
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B0000]" />
            <span className="text-xs text-[#795B62]">
              {periods.length} {periods.length === 1 ? 'cycle' : 'cycles'} recorded
            </span>
          </div>

          {periods.length > 0 ? (
            <div className="flex flex-wrap items-baseline gap-4 pt-1">
              <div>
                <span className="text-xs text-[#795B62] block">Average cycle:</span>
                <strong className="text-lg font-bold text-[#2B171B] font-serif">
                  {stats.averageCycleLength} days
                </strong>
              </div>
              <div className="border-l border-[#F5E6E8] pl-4">
                <span className="text-xs text-[#795B62] block">Average period:</span>
                <strong className="text-lg font-bold text-[#2B171B] font-serif">
                  {stats.averagePeriodDuration} days
                </strong>
              </div>
              <div className="border-l border-[#F5E6E8] pl-4">
                <span className="text-xs text-[#795B62] block">Variation:</span>
                <strong className="text-lg font-bold text-[#2B171B] font-serif">
                  ±{stats.cycleVariationDays} days
                </strong>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#795B62] pt-1">
              Insights become available as Aura learns your cycle pattern.
            </p>
          )}
        </div>

        <button
          onClick={() => onNavigateToTab('insights')}
          aria-label="View Full Insights Breakdown"
          className="self-stretch sm:self-center px-4 py-2.5 rounded-xl bg-[#FFF0F4] text-[#8B0000] text-xs font-semibold hover:bg-[#FCE4EC] transition-colors btn-press text-center min-h-[44px] flex items-center justify-center"
        >
          View Full Breakdown →
        </button>
      </div>

      {/* Large Calendar / Cycle Visualization */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-bold text-[#2B171B] font-serif">
            Monthly Cycle Calendar
          </h2>
          <button
            onClick={() => onNavigateToTab('calendar')}
            aria-label="Open Full Calendar"
            className="text-xs font-semibold text-[#8B0000] hover:underline flex items-center gap-1 btn-press py-2 min-h-[44px]"
          >
            <span>Full Calendar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <CalendarView
          periods={periods}
          dailyLogs={dailyLogs}
          calcResult={calcResult}
          onSelectDate={onSelectDate}
        />
      </div>
    </div>
  );
};
