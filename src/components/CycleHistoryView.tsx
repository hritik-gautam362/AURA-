/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CycleCalculationResult, HistoricalCycle, PeriodEntry } from '../types';
import { formatDisplayDate, formatDisplayMonth } from '../utils/cycleCalculations';
import {
  Calendar,
  Clock,
  Droplets,
  Edit3,
  Trash2,
  TrendingUp,
  Activity,
  PlusCircle,
} from 'lucide-react';

interface CycleHistoryViewProps {
  periods: PeriodEntry[];
  calcResult: CycleCalculationResult;
  onEditPeriod: (period: PeriodEntry) => void;
  onDeletePeriod: (id: string) => void;
  onAddNewPeriod: () => void;
}

export const CycleHistoryView: React.FC<CycleHistoryViewProps> = ({
  periods,
  calcResult,
  onEditPeriod,
  onDeletePeriod,
  onAddNewPeriod,
}) => {
  const { historicalCycles, averageCycleLength, averagePeriodDuration } = calcResult;

  // Compute stats
  const validLengths = historicalCycles
    .map((c) => c.cycleLengthDays)
    .filter((l): l is number => typeof l === 'number');

  const shortest = validLengths.length > 0 ? Math.min(...validLengths) : averageCycleLength;
  const longest = validLengths.length > 0 ? Math.max(...validLengths) : averageCycleLength;

  return (
    <div id="cycle-history-view" className="space-y-6">
      {/* Header & New Entry CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#2B171B] font-serif">
            Cycle History
          </h2>
          <p className="text-sm text-[#795B62]">
            Detailed records of past menstrual cycles and durations
          </p>
        </div>

        <button
          id="history-log-period-btn"
          onClick={onAddNewPeriod}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B0000] text-white text-sm font-semibold hover:bg-[#6D0000] transition-colors shadow-xs"
        >
          <PlusCircle className="w-4 h-4" />
          + Log Period
        </button>
      </div>

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-2xl border border-[#F5E6E8] shadow-xs">
          <span className="text-xs text-[#795B62] font-semibold uppercase tracking-wider block">
            Avg Cycle
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-[#8B0000] font-serif">
              {averageCycleLength}
            </span>
            <span className="text-xs text-[#795B62]">days</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#F5E6E8] shadow-xs">
          <span className="text-xs text-[#795B62] font-semibold uppercase tracking-wider block">
            Avg Period
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-[#C2185B] font-serif">
              {averagePeriodDuration}
            </span>
            <span className="text-xs text-[#795B62]">days</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#F5E6E8] shadow-xs">
          <span className="text-xs text-[#795B62] font-semibold uppercase tracking-wider block">
            Shortest
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-[#2B171B] font-serif">
              {shortest}
            </span>
            <span className="text-xs text-[#795B62]">days</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#F5E6E8] shadow-xs">
          <span className="text-xs text-[#795B62] font-semibold uppercase tracking-wider block">
            Longest
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-[#2B171B] font-serif">
              {longest}
            </span>
            <span className="text-xs text-[#795B62]">days</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#F5E6E8] shadow-xs col-span-2 sm:col-span-1">
          <span className="text-xs text-[#795B62] font-semibold uppercase tracking-wider block">
            Tracked
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-[#8B0000] font-serif">
              {periods.length}
            </span>
            <span className="text-xs text-[#795B62]">cycles</span>
          </div>
        </div>
      </div>

      {/* Visual Cycle Length History Chart */}
      {historicalCycles.length >= 2 && (
        <div className="bg-white rounded-3xl p-6 border border-[#F5E6E8] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#8B0000]" />
              <h3 className="text-base font-bold text-[#2B171B]">
                Cycle Length Consistency
              </h3>
            </div>
            <span className="text-xs text-[#795B62]">
              Baseline: {averageCycleLength} days
            </span>
          </div>

          <div className="h-32 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-[#F5E6E8]">
            {historicalCycles
              .filter((c) => typeof c.cycleLengthDays === 'number')
              .slice(0, 8)
              .reverse()
              .map((c) => {
                const len = c.cycleLengthDays || averageCycleLength;
                const maxChartHeight = 45;
                const heightPercent = Math.min(100, Math.max(20, (len / maxChartHeight) * 100));
                const diff = len - averageCycleLength;

                return (
                  <div key={c.id} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <span className="text-[10px] font-semibold text-[#8B0000] opacity-0 group-hover:opacity-100 transition-opacity">
                      {len}d
                    </span>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-300 ${
                        Math.abs(diff) <= 2
                          ? 'bg-[#F48FB1] group-hover:bg-[#C2185B]'
                          : 'bg-[#FFCDD2] group-hover:bg-[#8B0000]'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                    <span className="text-[10px] text-[#795B62] truncate max-w-full">
                      {formatDisplayDate(c.startDate, { month: 'short' })}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Recorded Cycle Cards */}
      <div className="space-y-3">
        {historicalCycles.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-[#F5E6E8] shadow-xs card-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF0F4] text-[#8B0000] flex items-center justify-center mx-auto mb-3">
              <Droplets className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-[#2B171B] font-serif">
              Start Your Cycle Journey
            </h3>
            <p className="text-sm text-[#795B62] max-w-md mx-auto mt-1 mb-6">
              Your cycle history will appear here after logging periods.
            </p>
            <button
              onClick={onAddNewPeriod}
              aria-label="Log Period"
              className="px-6 py-3 rounded-xl bg-[#8B0000] text-white text-sm font-semibold hover:bg-[#6D0000] transition-colors shadow-xs btn-press min-h-[44px]"
            >
              + Log Period
            </button>
          </div>
        ) : (
          historicalCycles.map((cycle, idx) => {
            const rawPeriod = periods.find((p) => p.id === cycle.id);
            const isOngoing = !cycle.endDate;

            return (
              <div
                key={cycle.id}
                id={`cycle-history-card-${cycle.id}`}
                className="bg-white rounded-2xl p-5 border border-[#F5E6E8] hover:border-[#F8BBD0] transition-colors shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-fade-in"
              >
                {/* Left: Month & Date Range */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-[#2B171B] font-serif">
                      {formatDisplayMonth(cycle.startDate)}
                    </h4>
                    {idx === 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-[#FFF0F4] text-[#8B0000] border border-[#FCE4EC]">
                        Current / Latest
                      </span>
                    )}
                    {isOngoing && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8F5E9] text-[#2E7D32]">
                        Ongoing
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-[#795B62] flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#8B0000]" />
                    <span>
                      {formatDisplayDate(cycle.startDate, { month: 'short', day: 'numeric' })}
                      {' – '}
                      {cycle.endDate
                        ? formatDisplayDate(cycle.endDate, { month: 'short', day: 'numeric' })
                        : 'Present'}
                    </span>
                  </p>

                  {/* Symptoms chips if present */}
                  {cycle.symptoms && cycle.symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {cycle.symptoms.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#FFF8FA] text-[#795B62] border border-[#F3E5E8]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Metrics & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#F5E6E8]">
                  <div className="text-left sm:text-right">
                    <span className="text-xs text-[#795B62] block">
                      Period Duration
                    </span>
                    <strong className="text-sm font-semibold text-[#C2185B]">
                      {cycle.durationDays} days
                    </strong>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xs text-[#795B62] block">
                      Cycle Length
                    </span>
                    <strong className="text-sm font-semibold text-[#8B0000]">
                      {cycle.cycleLengthDays !== null
                        ? `${cycle.cycleLengthDays} days`
                        : `${averageCycleLength} days (est)`}
                    </strong>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {rawPeriod && (
                      <button
                        onClick={() => onEditPeriod(rawPeriod)}
                        title="Edit entry"
                        aria-label="Edit period entry"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#795B62] hover:text-[#8B0000] hover:bg-[#FFF0F4] btn-press transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onDeletePeriod(cycle.id)}
                      title="Delete entry"
                      aria-label="Delete period entry"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#795B62] hover:text-[#B71C1C] hover:bg-[#FFF0F2] btn-press transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
