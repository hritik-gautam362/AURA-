/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FlowLevel, MoodType, PeriodEntry, SymptomType } from '../types';
import { getTodayDateString, diffInDays } from '../utils/cycleCalculations';
import { SymptomSelector } from './SymptomSelector';
import { MoodSelector } from './MoodSelector';
import { X, Droplets, Trash2, Calendar, AlertCircle } from 'lucide-react';

interface PeriodLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePeriod: (entry: PeriodEntry) => void;
  onDeletePeriod?: (id: string) => void;
  initialEntry?: PeriodEntry | null;
  defaultStartDate?: string;
}

export const PeriodLogModal: React.FC<PeriodLogModalProps> = ({
  isOpen,
  onClose,
  onSavePeriod,
  onDeletePeriod,
  initialEntry,
  defaultStartDate,
}) => {
  const todayStr = getTodayDateString();

  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>('');
  const [isOngoing, setIsOngoing] = useState<boolean>(false);
  const [flow, setFlow] = useState<FlowLevel>('medium');
  const [symptoms, setSymptoms] = useState<SymptomType[]>([]);
  const [mood, setMood] = useState<MoodType | undefined>(undefined);
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (initialEntry) {
      setStartDate(initialEntry.startDate);
      setEndDate(initialEntry.endDate || '');
      setIsOngoing(!initialEntry.endDate);
      setFlow(initialEntry.flow);
      setSymptoms(initialEntry.symptoms || []);
      setMood(initialEntry.mood);
      setNotes(initialEntry.notes || '');
    } else {
      setStartDate(defaultStartDate || todayStr);
      setEndDate('');
      setIsOngoing(false);
      setFlow('medium');
      setSymptoms([]);
      setMood(undefined);
      setNotes('');
    }
    setErrorMessage('');
  }, [initialEntry, defaultStartDate, isOpen, todayStr]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!startDate) {
      setErrorMessage('Please select a period start date.');
      return;
    }

    if (!isOngoing && endDate) {
      const days = diffInDays(startDate, endDate);
      if (days < 0) {
        setErrorMessage('Period end date cannot be earlier than the start date.');
        return;
      }
      if (days > 20) {
        setErrorMessage('Period duration cannot exceed 20 days. Please verify dates.');
        return;
      }
    }

    const newEntry: PeriodEntry = {
      id: initialEntry ? initialEntry.id : `period-${Date.now()}`,
      startDate,
      endDate: isOngoing ? null : endDate || null,
      flow,
      symptoms,
      mood,
      notes: notes.trim() || undefined,
      createdAt: initialEntry ? initialEntry.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSavePeriod(newEntry);
    onClose();
  };

  const handleDelete = () => {
    if (initialEntry && onDeletePeriod) {
      onDeletePeriod(initialEntry.id);
      onClose();
    }
  };

  return (
    <div
      id="period-log-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity"
    >
      <div
        id="period-log-modal"
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] flex flex-col shadow-2xl border border-[#F5E6E8] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-5 border-b border-[#F5E6E8]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0F4] text-[#8B0000] flex items-center justify-center shrink-0">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-[#2B171B] font-serif">
                {initialEntry ? 'Edit Period Entry' : 'Log Period'}
              </h3>
              <p className="text-[11px] sm:text-xs text-[#795B62]">
                Record start, duration, flow and symptoms
              </p>
            </div>
          </div>

          <button
            id="close-period-modal-btn"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#795B62] hover:bg-[#FFF0F4] hover:text-[#2B171B] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
          {errorMessage && (
            <div
              id="period-error-alert"
              className="p-3 bg-[#FFF0F2] border border-[#FFCDD2] rounded-xl text-xs text-[#B71C1C] flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Date Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#795B62]">
                Period Start *
              </label>
              <div className="relative">
                  <input
                  id="period-start-date-input"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl border border-[#F3E5E8] bg-white text-base sm:text-sm font-medium text-[#2B171B] min-h-[44px] focus:outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#795B62]">
                  Period End
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[#C2185B] font-medium cursor-pointer min-h-[36px] py-1">
                  <input
                    type="checkbox"
                    id="period-ongoing-checkbox"
                    checked={isOngoing}
                    onChange={(e) => {
                      setIsOngoing(e.target.checked);
                      if (e.target.checked) setEndDate('');
                    }}
                    className="accent-[#8B0000] rounded w-4 h-4"
                  />
                  Still ongoing
                </label>
              </div>
              <input
                id="period-end-date-input"
                type="date"
                disabled={isOngoing}
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Select end date"
                className="w-full px-3.5 py-3 rounded-xl border border-[#F3E5E8] bg-white text-base sm:text-sm font-medium text-[#2B171B] min-h-[44px] disabled:opacity-40 disabled:bg-[#FFF8FA] focus:outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000]"
              />
            </div>
          </div>

          {/* Flow Level */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#2B171B]">
              Flow Intensity
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { level: 'light', label: 'Light', drops: '💧' },
                  { level: 'medium', label: 'Medium', drops: '💧💧' },
                  { level: 'heavy', label: 'Heavy', drops: '💧💧💧' },
                ] as const
              ).map(({ level, label, drops }) => (
                <button
                  key={level}
                  type="button"
                  id={`flow-btn-${level}`}
                  onClick={() => setFlow(level)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-semibold transition-all min-h-[48px] btn-press ${
                    flow === level
                      ? 'bg-[#FCE4EC] border-[#8B0000] text-[#8B0000] shadow-xs'
                      : 'bg-white border-[#F3E5E8] text-[#795B62] hover:bg-[#FFF8FA]'
                  }`}
                >
                  <span className="text-base mb-1">{drops}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Symptoms */}
          <SymptomSelector
            selectedSymptoms={symptoms}
            onChange={(s) => setSymptoms(s)}
          />

          {/* Mood */}
          <MoodSelector
            selectedMood={mood}
            onChange={(m) => setMood(m)}
          />

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[#2B171B]">
              Personal Notes
            </label>
            <textarea
              id="period-notes-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any reflections, medication, or cycle notes..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#F3E5E8] bg-white text-base sm:text-sm text-[#2B171B] placeholder-[#A88B92] focus:outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000]"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#F5E6E8]">
            {initialEntry && onDeletePeriod ? (
              <button
                type="button"
                id="delete-period-entry-btn"
                onClick={handleDelete}
                className="min-h-[44px] flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#B71C1C] hover:bg-[#FFF0F2] btn-press transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Entry</span>
              </button>
            ) : (
              <button
                type="button"
                id="cancel-period-log-btn"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold text-[#795B62] hover:bg-[#FFF0F4] btn-press transition-colors"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              id="save-period-entry-btn"
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#8B0000] text-white text-sm font-semibold hover:bg-[#6D0000] transition-colors shadow-sm btn-press"
            >
              Save Period
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
