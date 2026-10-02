/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CycleCalculationResult } from '../types';
import { formatDisplayDate } from '../utils/cycleCalculations';
import { Calendar, Droplet, Sparkles, AlertCircle, PlusCircle } from 'lucide-react';

interface CycleCardProps {
  calcResult: CycleCalculationResult;
  onOpenLogPeriod: () => void;
  onOpenLogToday: () => void;
}

export const CycleCard: React.FC<CycleCardProps> = ({
  calcResult,
  onOpenLogPeriod,
  onOpenLogToday,
}) => {
  const {
    currentCycleDay,
    daysUntilNextPeriod,
    nextPeriodStartDate,
    averageCycleLength,
    currentPhase,
    phaseTitle,
    phaseDescription,
    isIrregular,
    irregularityMessage,
  } = calcResult;

  // Calculate percentage for circular progress
  const cycleDay = currentCycleDay || 1;
  const cycleTotal = averageCycleLength || 28;
  const progressPercent = Math.min(100, Math.max(0, (cycleDay / cycleTotal) * 100));

  // SVG circle calculation
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  // Phase color accents
  const getPhaseStyles = () => {
    switch (currentPhase) {
      case 'menstrual':
        return {
          badgeBg: 'bg-[#8B0000] text-white',
          ringColor: '#8B0000',
          title: 'Menstrual Phase',
        };
      case 'follicular':
        return {
          badgeBg: 'bg-[#FCE4EC] text-[#8B0000] border border-[#F8BBD0]',
          ringColor: '#E91E63',
          title: 'Follicular Phase',
        };
      case 'ovulation':
        return {
          badgeBg: 'bg-[#C2185B] text-white',
          ringColor: '#C2185B',
          title: 'Fertile & Ovulation',
        };
      case 'luteal':
        return {
          badgeBg: 'bg-[#FFF0F4] text-[#C2185B] border border-[#F8BBD0]',
          ringColor: '#F06292',
          title: 'Luteal Phase',
        };
      default:
        return {
          badgeBg: 'bg-[#FCE4EC] text-[#795B62]',
          ringColor: '#E0C8CF',
          title: 'Cycle Tracking',
        };
    }
  };

  const phaseStyle = getPhaseStyles();

  const isInitialState = !calcResult.latestPeriod || !nextPeriodStartDate || daysUntilNextPeriod === null;

  // Next period text
  const renderNextPeriodStatus = () => {
    if (isInitialState) {
      return 'Start Your Cycle Journey';
    }

    if (currentPhase === 'menstrual') {
      return 'Your period is currently being tracked';
    }

    if (daysUntilNextPeriod === 0) {
      return 'Your period is expected today';
    }
    if (daysUntilNextPeriod === 1) {
      return 'Your period is expected tomorrow';
    }
    if (daysUntilNextPeriod > 1) {
      return `Your period is expected in ${daysUntilNextPeriod} days`;
    }
    if (daysUntilNextPeriod < 0) {
      return `Period is ${Math.abs(daysUntilNextPeriod)} days later than usual estimate`;
    }
    return '';
  };

  return (
    <div
      id="cycle-dashboard-card"
      className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-[#F5E6E8] relative overflow-hidden card-fade-in"
    >
      {/* Background ambient glow */}
      <div
        className="absolute -right-16 -top-16 w-56 h-56 rounded-full opacity-30 pointer-events-none blur-3xl animate-aura-pulse"
        style={{ backgroundColor: '#FCE4EC' }}
      />

      <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-5 sm:gap-8">
        {/* Circular Progress Gauge */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg className="w-36 h-36 sm:w-44 sm:h-44 -rotate-90 transform" viewBox="0 0 160 160">
            {/* Background ring */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="#FCE4EC"
              strokeWidth="10"
              fill="transparent"
            />
            {/* Progress ring */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke={phaseStyle.ringColor}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {currentCycleDay ? (
              <>
                <span className="text-[10px] sm:text-xs uppercase tracking-wider text-[#795B62] font-semibold">
                  Cycle Day
                </span>
                <span className="text-3xl sm:text-4xl font-bold text-[#8B0000] my-0.5 tracking-tight font-serif">
                  {currentCycleDay}
                </span>
                <span className="text-[11px] sm:text-xs text-[#795B62]">
                  of {averageCycleLength} days
                </span>
              </>
            ) : (
              <>
                <Droplet className="w-6 h-6 text-[#8B0000] mb-1 opacity-80" />
                <span className="text-xs font-semibold text-[#8B0000]">
                  Day 1
                </span>
                <span className="text-[10px] text-[#795B62]">
                  Awaiting Log
                </span>
              </>
            )}
          </div>
        </div>

        {/* Cycle Information & Predictions */}
        <div className="flex-1 text-center md:text-left space-y-3 w-full">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span
              id="cycle-phase-badge"
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${phaseStyle.badgeBg}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isInitialState ? 'Ready to Begin' : phaseTitle}
            </span>

            {isIrregular && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFF3E0] text-[#B76E00]">
                <AlertCircle className="w-3 h-3" />
                Varied cycle
              </span>
            )}
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#2B171B] leading-tight font-serif">
              {renderNextPeriodStatus()}
            </h2>
            {nextPeriodStartDate ? (
              <p className="text-xs sm:text-sm text-[#795B62] mt-1 flex items-center justify-center md:justify-start gap-1.5 font-medium">
                <Calendar className="w-4 h-4 text-[#8B0000] shrink-0" />
                Next period estimate:{' '}
                <strong className="text-[#2B171B]">
                  {formatDisplayDate(nextPeriodStartDate, { month: 'long', day: 'numeric' })}
                </strong>
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-[#795B62] mt-1">
                Log your first period to unlock personalized cycle insights.
              </p>
            )}
          </div>

          <p className="text-xs sm:text-sm text-[#795B62] leading-relaxed max-w-xl">
            {isInitialState
              ? 'Record when your period begins. Orienta calculates cycle lengths, predicts fertile phases, and keeps your private wellness rhythm on this device.'
              : phaseDescription}
          </p>

          {irregularityMessage && (
            <div className="p-3 bg-[#FFFBF0] border border-[#FFE082] rounded-xl text-xs text-[#825300] flex items-start gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{irregularityMessage}</span>
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center md:justify-start gap-2.5 sm:gap-3">
            <button
              id="cycle-card-log-period-btn"
              onClick={onOpenLogPeriod}
              aria-label="Log Period"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 rounded-xl bg-[#8B0000] text-white text-sm font-semibold hover:bg-[#6D0000] transition-colors shadow-sm btn-press min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Log Period</span>
            </button>

            <button
              id="cycle-card-log-today-btn"
              onClick={onOpenLogToday}
              aria-label="Log Today's Symptoms"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl bg-[#FCE4EC] text-[#8B0000] text-sm font-semibold hover:bg-[#F8BBD0] transition-colors btn-press min-h-[44px]"
            >
              <span>Log Today's Symptoms</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
