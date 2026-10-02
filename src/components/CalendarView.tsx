/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  CycleCalculationResult,
  DailyLog,
  PeriodEntry,
} from '../types';
import {
  addDays,
  diffInDays,
  formatLocalDate,
  getTodayDateString,
  isDateInFertileWindow,
  isDateInLoggedPeriod,
  isDateInPredictedPeriod,
} from '../utils/cycleCalculations';
import { ChevronLeft, ChevronRight, Droplet, Sparkles, CircleDot } from 'lucide-react';

interface CalendarViewProps {
  periods: PeriodEntry[];
  dailyLogs: Record<string, DailyLog>;
  calcResult: CycleCalculationResult;
  onSelectDate: (dateStr: string) => void;
  selectedDate?: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  periods,
  dailyLogs,
  calcResult,
  onSelectDate,
  selectedDate,
}) => {
  const todayStr = getTodayDateString();

  // Selected view month (defaults to current month)
  const [currentYear, setCurrentYear] = useState(() => {
    const today = new Date();
    return today.getFullYear();
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return today.getMonth(); // 0-indexed
  });

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    onSelectDate(todayStr);
  };

  // Compute days in the current month view
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const monthName = firstDayOfMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Generate calendar cells (including padding for first week)
  const calendarCells = [];

  // Padding days from previous month
  const prevMonthLastDate = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDate - i;
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarCells.push({
      dateStr,
      dayNumber: day,
      isCurrentMonth: false,
    });
  }

  // Days of current month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarCells.push({
      dateStr,
      dayNumber: day,
      isCurrentMonth: true,
    });
  }

  // Next month padding to fill grid
  const remainingCells = 42 - calendarCells.length; // 6 rows * 7 days
  const nextMonthPadding = remainingCells >= 7 ? remainingCells - 7 : remainingCells;
  for (let day = 1; day <= nextMonthPadding; day++) {
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarCells.push({
      dateStr,
      dayNumber: day,
      isCurrentMonth: false,
    });
  }

  // Cell status evaluator
  const getDayStatus = (dateStr: string) => {
    const isPeriod = isDateInLoggedPeriod(dateStr, periods);
    const isPredicted = !isPeriod && isDateInPredictedPeriod(dateStr, calcResult.predictedCycles);
    const { isFertile, isOvulation } = isDateInFertileWindow(dateStr, calcResult);
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;
    const hasDailyLog = !!dailyLogs[dateStr];
    const logDetails = dailyLogs[dateStr];

    return {
      isPeriod,
      isPredicted,
      isFertile: isFertile && !isPeriod,
      isOvulation: isOvulation && !isPeriod,
      isToday,
      isSelected,
      hasDailyLog,
      hasNotes: !!logDetails?.notes,
      symptomsCount: logDetails?.symptoms?.length || 0,
    };
  };

  return (
    <div
      id="calendar-widget"
      className="bg-white rounded-3xl p-3.5 sm:p-7 shadow-sm border border-[#F5E6E8]"
    >
      {/* Calendar Header: Month title & navigation */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h3 className="text-lg sm:text-2xl font-bold text-[#2B171B] font-serif">
            {monthName}
          </h3>
          <p className="text-[11px] sm:text-xs text-[#795B62] mt-0.5">
            Click any date to log symptoms or flow
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            id="calendar-today-btn"
            onClick={handleJumpToToday}
            className="px-3 py-2 text-xs font-semibold text-[#8B0000] bg-[#FFF0F4] hover:bg-[#FCE4EC] rounded-xl transition-colors min-h-[44px] flex items-center justify-center btn-press"
          >
            Today
          </button>
          <button
            id="calendar-prev-month-btn"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className="p-2 rounded-xl text-[#795B62] hover:bg-[#FFF0F4] hover:text-[#8B0000] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center btn-press"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            id="calendar-next-month-btn"
            onClick={handleNextMonth}
            aria-label="Next month"
            className="p-2 rounded-xl text-[#795B62] hover:bg-[#FFF0F4] hover:text-[#8B0000] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center btn-press"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[11px] sm:text-xs font-semibold text-[#795B62]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {calendarCells.map((cell) => {
          const status = getDayStatus(cell.dateStr);

          // Determine cell styling
          let bgClasses = 'hover:bg-[#FFF8FA] text-[#2B171B]';
          let borderClasses = 'border border-transparent';
          let indicatorBadge = null;

          if (status.isPeriod) {
            bgClasses = 'bg-[#8B0000] text-white hover:bg-[#720000] shadow-xs';
          } else if (status.isPredicted) {
            bgClasses = 'bg-[#FFEBEE] text-[#C2185B] border border-dashed border-[#F48FB1]';
          } else if (status.isOvulation) {
            bgClasses = 'bg-[#FCE4EC] text-[#8B0000] border border-[#C2185B]';
            indicatorBadge = (
              <span className="w-1.5 h-1.5 rounded-full bg-[#C2185B]" />
            );
          } else if (status.isFertile) {
            bgClasses = 'bg-[#FFF0F4] text-[#C2185B]';
          }

          if (status.isToday) {
            borderClasses = status.isPeriod
              ? 'ring-2 ring-white ring-offset-2 ring-offset-[#8B0000]'
              : 'ring-2 ring-[#8B0000] ring-offset-1';
          }

          if (status.isSelected) {
            borderClasses += ' scale-105 shadow-md z-10';
          }

          const opacityClass = cell.isCurrentMonth ? 'opacity-100' : 'opacity-35';

          return (
            <button
              key={cell.dateStr}
              id={`calendar-day-${cell.dateStr}`}
              onClick={() => onSelectDate(cell.dateStr)}
              className={`relative flex flex-col items-center justify-between p-1 sm:p-2 h-11 sm:h-14 rounded-xl sm:rounded-2xl transition-all ${bgClasses} ${borderClasses} ${opacityClass}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] sm:text-sm font-semibold leading-none">
                  {cell.dayNumber}
                </span>
                {status.isOvulation && (
                  <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#C2185B] shrink-0" />
                )}
                {status.isPeriod && (
                  <Droplet className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white/90 shrink-0" />
                )}
              </div>

              {/* Dot Indicators for symptoms / notes */}
              <div className="flex items-center gap-1 mt-auto">
                {status.hasDailyLog && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      status.isPeriod ? 'bg-white' : 'bg-[#E91E63]'
                    }`}
                  />
                )}
                {status.hasNotes && !status.hasDailyLog && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#795B62]" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Visual Legend */}
      <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-[#F5E6E8] grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-[11px] sm:text-xs text-[#795B62]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-md bg-[#8B0000] shrink-0" />
          <span className="font-medium text-[#2B171B]">Period days</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-md bg-[#FFEBEE] border border-dashed border-[#F48FB1] shrink-0" />
          <span className="font-medium text-[#2B171B]">Predicted period</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-md bg-[#FFF0F4] shrink-0" />
          <span className="font-medium text-[#2B171B]">Fertile window</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-md bg-[#FCE4EC] border border-[#C2185B] flex items-center justify-center shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C2185B]" />
          </span>
          <span className="font-medium text-[#2B171B]">Estimated ovulation</span>
        </div>
      </div>
    </div>
  );
};
