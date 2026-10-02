/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DailyLog, EnergyLevel, FlowLevel, MoodType, SymptomType } from '../types';
import { formatDisplayDate } from '../utils/cycleCalculations';
import { SymptomSelector } from './SymptomSelector';
import { MoodSelector } from './MoodSelector';
import { X, Calendar, Battery, BatteryMedium, BatteryLow, Trash2, Droplets } from 'lucide-react';

interface DailyLogModalProps {
  isOpen: boolean;
  dateStr: string;
  onClose: () => void;
  existingLog?: DailyLog;
  onSaveLog: (log: DailyLog) => void;
  onDeleteLog?: (dateStr: string) => void;
  onLogAsPeriod?: (dateStr: string) => void;
}

export const DailyLogModal: React.FC<DailyLogModalProps> = ({
  isOpen,
  dateStr,
  onClose,
  existingLog,
  onSaveLog,
  onDeleteLog,
  onLogAsPeriod,
}) => {
  const [isPeriodDay, setIsPeriodDay] = useState<boolean>(false);
  const [flow, setFlow] = useState<FlowLevel | undefined>(undefined);
  const [symptoms, setSymptoms] = useState<SymptomType[]>([]);
  const [mood, setMood] = useState<MoodType | undefined>(undefined);
  const [energy, setEnergy] = useState<EnergyLevel | undefined>(undefined);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (existingLog) {
      setIsPeriodDay(existingLog.isPeriodDay);
      setFlow(existingLog.flow);
      setSymptoms(existingLog.symptoms || []);
      setMood(existingLog.mood);
      setEnergy(existingLog.energy);
      setNotes(existingLog.notes || '');
    } else {
      setIsPeriodDay(false);
      setFlow(undefined);
      setSymptoms([]);
      setMood(undefined);
      setEnergy(undefined);
      setNotes('');
    }
  }, [existingLog, dateStr, isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: DailyLog = {
      date: dateStr,
      isPeriodDay,
      flow: isPeriodDay ? flow || 'medium' : undefined,
      symptoms,
      mood,
      energy,
      notes: notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    onSaveLog(updated);
    onClose();
  };

  const handleDelete = () => {
    if (onDeleteLog) {
      onDeleteLog(dateStr);
      onClose();
    }
  };

  return (
    <div
      id="daily-log-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity"
    >
      <div
        id="daily-log-modal"
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] flex flex-col shadow-2xl border border-[#F5E6E8] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-5 border-b border-[#F5E6E8]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0F4] text-[#8B0000] flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-[#2B171B] font-serif">
                {formatDisplayDate(dateStr, { weekday: 'short', month: 'short', day: 'numeric' })}
              </h3>
              <p className="text-[11px] sm:text-xs text-[#795B62]">
                Daily log, symptoms & vitality
              </p>
            </div>
          </div>

          <button
            id="close-daily-modal-btn"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#795B62] hover:bg-[#FFF0F4] hover:text-[#2B171B] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
          {/* Period Day Toggle */}
          <div className="p-4 rounded-2xl bg-[#FFF8FA] border border-[#F5E6E8] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#8B0000] text-white flex items-center justify-center">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#2B171B]">
                    Bleeding / Period on this day
                  </h4>
                  <p className="text-xs text-[#795B62]">
                    Track flow for this single day
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="daily-period-toggle"
                  checked={isPeriodDay}
                  onChange={(e) => setIsPeriodDay(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#E0D0D5] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#E0D0D5] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B0000]"></div>
              </label>
            </div>

            {isPeriodDay && (
              <div className="pt-2 border-t border-[#F0DFE3] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#795B62]">Flow:</span>
                <div className="flex gap-2">
                  {(['light', 'medium', 'heavy'] as FlowLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setFlow(lvl)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize border transition-all min-h-[44px] min-w-[50px] btn-press ${
                        (flow || 'medium') === lvl
                          ? 'bg-[#8B0000] text-white border-[#8B0000]'
                          : 'bg-white text-[#795B62] border-[#E0D0D5] hover:bg-[#FFF0F4]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Energy Level */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#2B171B]">
              Energy Level
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { level: 'low', label: 'Low', icon: BatteryLow },
                  { level: 'normal', label: 'Normal', icon: BatteryMedium },
                  { level: 'high', label: 'High', icon: Battery },
                ] as const
              ).map(({ level, label, icon: Icon }) => (
                <button
                  key={level}
                  type="button"
                  id={`energy-btn-${level}`}
                  onClick={() => setEnergy(energy === level ? undefined : level)}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all min-h-[44px] btn-press ${
                    energy === level
                      ? 'bg-[#FCE4EC] border-[#C2185B] text-[#8B0000] shadow-xs'
                      : 'bg-white border-[#F3E5E8] text-[#795B62] hover:bg-[#FFF8FA]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Symptoms Checklist */}
          <SymptomSelector
            selectedSymptoms={symptoms}
            onChange={(s) => setSymptoms(s)}
          />

          {/* Mood Selector */}
          <MoodSelector
            selectedMood={mood}
            onChange={(m) => setMood(m)}
          />

          {/* Daily Notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[#2B171B]">
              Notes
            </label>
            <textarea
              id="daily-notes-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How are you feeling today? Any specific symptoms or thoughts..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#F3E5E8] bg-white text-base sm:text-sm text-[#2B171B] placeholder-[#A88B92] focus:outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000]"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#F5E6E8]">
            {existingLog && onDeleteLog ? (
              <button
                type="button"
                id="delete-daily-log-btn"
                onClick={handleDelete}
                className="min-h-[44px] flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#B71C1C] hover:bg-[#FFF0F2] btn-press transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear Day</span>
              </button>
            ) : (
              <button
                type="button"
                id="cancel-daily-log-btn"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold text-[#795B62] hover:bg-[#FFF0F4] btn-press transition-colors"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              id="save-daily-log-btn"
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#8B0000] text-white text-sm font-semibold hover:bg-[#6D0000] transition-colors shadow-sm btn-press"
            >
              Save Day
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
