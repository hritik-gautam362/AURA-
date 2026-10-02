/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CycleCalculationResult, CycleStatistics } from '../types';
import {
  Sparkles,
  Heart,
  Activity,
  ShieldAlert,
  Moon,
  Sun,
  Flame,
  Droplet,
  Info,
} from 'lucide-react';

interface InsightsViewProps {
  calcResult: CycleCalculationResult;
  stats: CycleStatistics;
}

export const InsightsView: React.FC<InsightsViewProps> = ({ calcResult, stats }) => {
  const { isIrregular } = calcResult;

  const phasesGuide = [
    {
      name: 'Menstrual Phase',
      days: `Days 1–${stats.averagePeriodDuration}`,
      icon: Droplet,
      color: 'text-[#8B0000]',
      bgColor: 'bg-[#FFF0F4]',
      borderColor: 'border-[#F8BBD0]',
      summary: 'Hormone levels drop to their lowest. The uterine lining sheds as menstruation occurs.',
      tips: 'Prioritize iron-rich foods, magnesium, warming teas, and rest. Gentle walks and restorative yoga.',
    },
    {
      name: 'Follicular Phase',
      days: `Days ${stats.averagePeriodDuration + 1}–${Math.max(stats.averagePeriodDuration + 1, stats.averageCycleLength - 15)}`,
      icon: Sun,
      color: 'text-[#C2185B]',
      bgColor: 'bg-[#FFF8FA]',
      borderColor: 'border-[#FCE4EC]',
      summary: 'FSH stimulates follicle growth and estrogen climbs steadily, boosting brain chemistry.',
      tips: 'Higher energy and optimism. Great time for creative projects, social outings, and strength training.',
    },
    {
      name: 'Ovulation Phase',
      days: `Day ~${stats.averageCycleLength - 14} (Peak Fertile Window)`,
      icon: Sparkles,
      color: 'text-[#8B0000]',
      bgColor: 'bg-[#FCE4EC]',
      borderColor: 'border-[#C2185B]',
      summary: 'A surge in luteinizing hormone (LH) triggers release of a mature egg.',
      tips: 'Peak communication skills and libido. Stay hydrated and nourish with leafy greens and antioxidants.',
    },
    {
      name: 'Luteal Phase',
      days: `Days ~${stats.averageCycleLength - 13}–${stats.averageCycleLength}`,
      icon: Moon,
      color: 'text-[#795B62]',
      bgColor: 'bg-[#FFF8FA]',
      borderColor: 'border-[#F5E6E8]',
      summary: 'Progesterone peaks to nurture a potential pregnancy, then declines if conception did not happen.',
      tips: 'You may feel more inward-focused or crave comfort foods. Prioritize B-complex vitamins, hydration, and soothing routines.',
    },
  ];

  return (
    <div id="insights-view" className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#2B171B] font-serif">
          Cycle Insights
        </h2>
        <p className="text-sm text-[#795B62] mt-1">
          Personalized patterns, symptom frequencies, and hormonal phase guidance
        </p>
      </div>

      {/* Empty State Banner if no cycle data */}
      {stats.totalCycles === 0 && (
        <div className="p-6 rounded-3xl bg-white border border-[#F5E6E8] shadow-xs flex items-center gap-4 card-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF0F4] text-[#8B0000] flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#2B171B] font-serif">
              Insights in Progress
            </h3>
            <p className="text-xs text-[#795B62] mt-0.5">
              Insights become available as Aura learns your cycle pattern.
            </p>
          </div>
        </div>
      )}

      {/* Top 3 Core Metric Banners */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 bg-white rounded-3xl border border-[#F5E6E8] shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#795B62]">
            Average Cycle
          </span>
          <div className="my-2">
            <span className="text-3xl font-bold text-[#8B0000] font-serif">
              {stats.averageCycleLength}
            </span>
            <span className="text-sm text-[#795B62] ml-1">days</span>
          </div>
          <p className="text-xs text-[#795B62]">
            Typical healthy range is 21 to 35 days.
          </p>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-[#F5E6E8] shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#795B62]">
            Average Period
          </span>
          <div className="my-2">
            <span className="text-3xl font-bold text-[#C2185B] font-serif">
              {stats.averagePeriodDuration}
            </span>
            <span className="text-sm text-[#795B62] ml-1">days</span>
          </div>
          <p className="text-xs text-[#795B62]">
            Normal bleeding span is typically 3 to 7 days.
          </p>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-[#F5E6E8] shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#795B62]">
            Cycle Variation
          </span>
          <div className="my-2">
            <span className="text-3xl font-bold text-[#2B171B] font-serif">
              ±{stats.cycleVariationDays}
            </span>
            <span className="text-sm text-[#795B62] ml-1">days</span>
          </div>
          <p className="text-xs text-[#795B62]">
            {isIrregular
              ? 'Moderate variation detected across recorded cycles.'
              : 'Consistent and highly predictable cycle rhythm.'}
          </p>
        </div>
      </div>

      {/* Symptom & Mood Distribution Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Common Symptoms Chart */}
        <div className="p-6 bg-white rounded-3xl border border-[#F5E6E8] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#2B171B] font-serif flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#8B0000]" />
              Most Common Symptoms
            </h3>
            <span className="text-xs text-[#795B62]">From logged entries</span>
          </div>

          {stats.mostCommonSymptoms.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#795B62]">
              Log symptoms during your cycle to reveal your most frequent bodily signals.
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {stats.mostCommonSymptoms.map(({ symptom, count, percentage }) => (
                <div key={symptom} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#2B171B]">{symptom}</span>
                    <span className="text-[#795B62] font-medium">
                      {count} times ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#FFF0F4] rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-[#C2185B] h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(8, percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-[#795B62] pt-2 border-t border-[#F5E6E8]">
            Based on your logged data across all past recorded periods and daily check-ins.
          </p>
        </div>

        {/* Mood Distribution */}
        <div className="p-6 bg-white rounded-3xl border border-[#F5E6E8] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#2B171B] font-serif flex items-center gap-2">
              <Heart className="w-4 h-4 text-[#C2185B]" />
              Mood Distribution
            </h3>
            <span className="text-xs text-[#795B62]">Emotional rhythm</span>
          </div>

          {stats.moodDistribution.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#795B62]">
              Track your daily mood to visualize emotional fluctuations across cycle phases.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {stats.moodDistribution.slice(0, 6).map(({ mood, count }) => (
                <div
                  key={mood}
                  className="p-3 rounded-2xl bg-[#FFF8FA] border border-[#F3E5E8] flex items-center justify-between"
                >
                  <span className="text-xs font-semibold text-[#2B171B]">{mood}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FCE4EC] text-[#8B0000]">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-[#795B62] pt-2 border-t border-[#F5E6E8]">
            Noticing mood shifts helps align work and rest with natural hormonal rhythms.
          </p>
        </div>
      </div>

      {/* Cycle Phases Educational Guide */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-bold text-[#2B171B] font-serif">
            Understanding Your Four Phases
          </h3>
          <p className="text-xs text-[#795B62] mt-0.5">
            How hormones shift energy, mood, and physical well-being throughout the month
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {phasesGuide.map((phase) => {
            const Icon = phase.icon;
            const isCurrent =
              (phase.name.toLowerCase().includes('menstrual') && calcResult.currentPhase === 'menstrual') ||
              (phase.name.toLowerCase().includes('follicular') && calcResult.currentPhase === 'follicular') ||
              (phase.name.toLowerCase().includes('ovulation') && calcResult.currentPhase === 'ovulation') ||
              (phase.name.toLowerCase().includes('luteal') && calcResult.currentPhase === 'luteal');

            return (
              <div
                key={phase.name}
                className={`p-5 rounded-3xl border transition-all ${
                  isCurrent
                    ? 'bg-white border-[#8B0000] ring-1 ring-[#8B0000] shadow-sm'
                    : 'bg-white border-[#F5E6E8]'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl ${phase.bgColor} ${phase.color} flex items-center justify-center`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#2B171B]">{phase.name}</h4>
                      <span className="text-[11px] text-[#795B62]">{phase.days}</span>
                    </div>
                  </div>

                  {isCurrent && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#8B0000] text-white">
                      You are here
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#2B171B] leading-relaxed mb-2.5">
                  {phase.summary}
                </p>

                <div className="p-2.5 rounded-xl bg-[#FFF8FA] border border-[#F3E5E8] text-[11px] text-[#795B62]">
                  <strong className="text-[#8B0000] font-semibold">Self-Care: </strong>
                  {phase.tips}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Medical Disclaimer Banner */}
      <div className="p-4 rounded-2xl bg-[#FFF9F9] border border-[#FFCDD2] flex items-start gap-3 text-xs text-[#795B62] leading-relaxed">
        <Info className="w-5 h-5 text-[#C2185B] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#2B171B] font-semibold block mb-0.5">
            Informational Use Only
          </strong>
          This application provides cycle tracking and calculated estimates for informational purposes only. It is not a medical diagnostic tool, nor should it be relied upon as a method of contraception. Always consult a qualified healthcare provider for personalized medical advice.
        </div>
      </div>
    </div>
  );
};
