/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SymptomType } from '../types';
import {
  Activity,
  AlertCircle,
  Coffee,
  HeartCrack,
  Moon,
  Sparkles,
  Zap,
  Flame,
  Frown,
  Pill,
} from 'lucide-react';

interface SymptomSelectorProps {
  selectedSymptoms: SymptomType[];
  onChange: (symptoms: SymptomType[]) => void;
}

const ALL_SYMPTOMS: { name: SymptomType; icon: React.ComponentType<{ className?: string }> }[] = [
  { name: 'Cramps', icon: Flame },
  { name: 'Headache', icon: Zap },
  { name: 'Back pain', icon: Activity },
  { name: 'Bloating', icon: Sparkles },
  { name: 'Breast tenderness', icon: HeartCrack },
  { name: 'Fatigue', icon: Moon },
  { name: 'Acne', icon: AlertCircle },
  { name: 'Nausea', icon: Coffee },
  { name: 'Mood swings', icon: Frown },
  { name: 'Cravings', icon: Pill },
  { name: 'Insomnia', icon: Moon },
  { name: 'Other', icon: Activity },
];

export const SymptomSelector: React.FC<SymptomSelectorProps> = ({
  selectedSymptoms,
  onChange,
}) => {
  const toggleSymptom = (symptom: SymptomType) => {
    if (selectedSymptoms.includes(symptom)) {
      onChange(selectedSymptoms.filter((s) => s !== symptom));
    } else {
      onChange([...selectedSymptoms, symptom]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-[#2B171B]">
        Symptoms
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ALL_SYMPTOMS.map(({ name, icon: Icon }) => {
          const isSelected = selectedSymptoms.includes(name);
          return (
            <button
              key={name}
              type="button"
              id={`symptom-btn-${name.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => toggleSymptom(name)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left min-h-[44px] btn-press ${
                isSelected
                  ? 'bg-[#FCE4EC] border-[#C2185B] text-[#8B0000] shadow-xs'
                  : 'bg-white border-[#F3E5E8] text-[#795B62] hover:border-[#F8BBD0] hover:bg-[#FFF8FA]'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isSelected ? 'text-[#C2185B]' : 'text-[#795B62]'
                }`}
              />
              <span className="truncate">{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
