/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MoodType } from '../types';
import { Smile, Heart, Meh, Frown, AlertTriangle, Moon, Sparkles } from 'lucide-react';

interface MoodSelectorProps {
  selectedMood?: MoodType;
  onChange: (mood: MoodType) => void;
}

const ALL_MOODS: { mood: MoodType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { mood: 'Happy', label: 'Happy', icon: Smile },
  { mood: 'Calm', label: 'Calm', icon: Heart },
  { mood: 'Energetic', label: 'Energetic', icon: Sparkles },
  { mood: 'Irritated', label: 'Irritated', icon: Meh },
  { mood: 'Sad', label: 'Sad', icon: Frown },
  { mood: 'Anxious', label: 'Anxious', icon: AlertTriangle },
  { mood: 'Tired', label: 'Tired', icon: Moon },
];

export const MoodSelector: React.FC<MoodSelectorProps> = ({ selectedMood, onChange }) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-[#2B171B]">Mood</label>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {ALL_MOODS.map(({ mood, label, icon: Icon }) => {
          const isSelected = selectedMood === mood;
          return (
            <button
              key={mood}
              type="button"
              id={`mood-btn-${mood.toLowerCase()}`}
              onClick={() => onChange(mood)}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all min-h-[44px] btn-press ${
                isSelected
                  ? 'bg-[#FCE4EC] border-[#C2185B] text-[#8B0000] shadow-xs'
                  : 'bg-white border-[#F3E5E8] text-[#795B62] hover:border-[#F8BBD0] hover:bg-[#FFF8FA]'
              }`}
            >
              <Icon
                className={`w-5 h-5 mb-1 ${
                  isSelected ? 'text-[#C2185B]' : 'text-[#795B62]'
                }`}
              />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
