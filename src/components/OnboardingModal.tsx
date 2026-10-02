/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PeriodEntry, UserSettings } from '../types';
import { getTodayDateString } from '../utils/cycleCalculations';
import {
  Sparkles,
  Calendar,
  TrendingUp,
  ArrowRight,
  Check,
  Droplet,
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (settings: Partial<UserSettings>, firstPeriod?: PeriodEntry) => void;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
  onClose,
}) => {
  const todayStr = getTodayDateString();
  const [step, setStep] = useState<number>(1);

  // Form states
  const [lastPeriodStart, setLastPeriodStart] = useState<string>('');
  const [cycleLength, setCycleLength] = useState<number>(28);
  const [periodDuration, setPeriodDuration] = useState<number>(5);
  const [userName, setUserName] = useState<string>('');
  const [knowsLastPeriod, setKnowsLastPeriod] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleFinish = () => {
    let firstPeriod: PeriodEntry | undefined = undefined;

    if (knowsLastPeriod && lastPeriodStart) {
      firstPeriod = {
        id: `period-onboard-${Date.now()}`,
        startDate: lastPeriodStart,
        endDate: null, // Initial ongoing or default
        flow: 'medium',
        symptoms: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    onComplete(
      {
        userName: userName.trim() || 'Lovely',
        defaultCycleLength: cycleLength || 28,
        defaultPeriodDuration: periodDuration || 5,
        hasCompletedOnboarding: true,
      },
      firstPeriod
    );
  };

  return (
    <div
      id="onboarding-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/50 backdrop-blur-xs transition-all"
    >
      <div
        id="onboarding-modal"
        className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-8 max-h-[90dvh] overflow-y-auto shadow-2xl border border-[#F5E6E8] relative"
      >
        {/* Decorative circle glow */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#FCE4EC] rounded-full blur-2xl opacity-60 pointer-events-none" />

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center gap-3.5 mx-auto">
              <img
                src="/orienta-symbol.png"
                alt="Orienta Logo Symbol"
                className="w-14 h-14 rounded-2xl object-contain shadow-xs shrink-0"
              />
              <div className="flex flex-col text-left justify-center leading-none">
                <span className="text-2xl font-bold text-[#2B171B] tracking-tight font-sans">
                  Orienta
                </span>
                <span className="text-xs text-[#795B62] font-medium tracking-wide mt-1">
                  by FillFlow
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-[#2B171B] font-serif">
                Understand your cycle better.
              </h3>
              <p className="text-sm text-[#795B62] leading-relaxed">
                Connect deeply with your natural rhythms. Track fertility, hormonal phases, and bodily vitality in one serene place.
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={() => setStep(2)}
                className="w-full min-h-[48px] py-3.5 rounded-2xl bg-[#8B0000] text-white text-sm font-semibold hover:bg-[#6D0000] transition-all flex items-center justify-center gap-2 shadow-xs btn-press"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-[#FFF0F4] text-[#C2185B] flex items-center justify-center mx-auto shadow-xs">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-[#2B171B] font-serif">
                Track your period, symptoms and cycle patterns.
              </h3>
              <p className="text-sm text-[#795B62] leading-relaxed">
                Log flow intensity, cramps, mood shifts, and energy levels to build a private, compassionate picture of your health.
              </p>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 min-h-[48px] py-3 rounded-2xl border border-[#F3E5E8] text-xs font-semibold text-[#795B62] hover:bg-[#FFF8FA] flex items-center justify-center btn-press"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="w-2/3 min-h-[48px] py-3.5 rounded-2xl bg-[#8B0000] text-white text-sm font-semibold hover:bg-[#6D0000] transition-all flex items-center justify-center gap-2 shadow-xs btn-press"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-[#FFF0F4] text-[#8B0000] flex items-center justify-center mx-auto shadow-xs">
              <TrendingUp className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-[#2B171B] font-serif">
                Get personalized cycle estimates based on your data.
              </h3>
              <p className="text-sm text-[#795B62] leading-relaxed">
                As you log real cycles, our engine dynamically refines ovulation, fertile windows, and future period dates.
              </p>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="w-1/3 min-h-[48px] py-3 rounded-2xl border border-[#F3E5E8] text-xs font-semibold text-[#795B62] hover:bg-[#FFF8FA] flex items-center justify-center btn-press"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="w-2/3 min-h-[48px] py-3.5 rounded-2xl bg-[#8B0000] text-white text-sm font-semibold hover:bg-[#6D0000] transition-all flex items-center justify-center gap-2 shadow-xs btn-press"
              >
                <span>Set Up My Cycle</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Setup Questions */}
        {step === 4 && (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-[#2B171B] font-serif">
                Let's personalize your tracking
              </h3>
              <p className="text-xs text-[#795B62]">
                These can always be updated later in Settings.
              </p>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#795B62]">
                  What should we call you? (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Your preferred name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#F3E5E8] bg-white text-sm text-[#2B171B] focus:outline-none focus:border-[#8B0000] min-h-[44px]"
                />
              </div>

              {/* Last Period Start */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#795B62]">
                    When did your last period start?
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setKnowsLastPeriod(!knowsLastPeriod);
                      if (knowsLastPeriod) setLastPeriodStart('');
                    }}
                    className="text-xs text-[#C2185B] font-semibold hover:underline min-h-[44px] flex items-center btn-press"
                  >
                    {knowsLastPeriod ? "I don't know" : 'Set date'}
                  </button>
                </div>

                {knowsLastPeriod ? (
                  <input
                    type="date"
                    max={todayStr}
                    value={lastPeriodStart}
                    onChange={(e) => setLastPeriodStart(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#F3E5E8] bg-white text-sm text-[#2B171B] focus:outline-none focus:border-[#8B0000] min-h-[44px]"
                  />
                ) : (
                  <p className="text-xs text-[#795B62] bg-[#FFF8FA] p-2.5 rounded-xl border border-[#F3E5E8]">
                    No problem! You can tap "+ Log Period" anytime you start your next cycle.
                  </p>
                )}
              </div>

              {/* Usual Cycle Length */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#795B62]">
                  What is your usual cycle length? (Average: 28 days)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={20}
                    max={60}
                    value={cycleLength}
                    onChange={(e) => setCycleLength(Number(e.target.value))}
                    className="w-24 px-3.5 py-2 rounded-xl border border-[#F3E5E8] text-sm text-[#2B171B] focus:outline-none focus:border-[#8B0000] min-h-[44px]"
                  />
                  <span className="text-xs text-[#795B62]">days</span>
                  <button
                    type="button"
                    onClick={() => setCycleLength(28)}
                    className="text-xs text-[#8B0000] ml-auto hover:underline min-h-[44px] px-2 flex items-center btn-press"
                  >
                    Default (28)
                  </button>
                </div>
              </div>

              {/* Usual Period Duration */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#795B62]">
                  What is your usual period duration? (Average: 5 days)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={2}
                    max={14}
                    value={periodDuration}
                    onChange={(e) => setPeriodDuration(Number(e.target.value))}
                    className="w-24 px-3.5 py-2 rounded-xl border border-[#F3E5E8] text-sm text-[#2B171B] focus:outline-none focus:border-[#8B0000] min-h-[44px]"
                  />
                  <span className="text-xs text-[#795B62]">days</span>
                  <button
                    type="button"
                    onClick={() => setPeriodDuration(5)}
                    className="text-xs text-[#8B0000] ml-auto hover:underline min-h-[44px] px-2 flex items-center btn-press"
                  >
                    Default (5)
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="w-1/3 min-h-[48px] py-3 rounded-2xl border border-[#F3E5E8] text-xs font-semibold text-[#795B62] hover:bg-[#FFF8FA] flex items-center justify-center btn-press"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                id="finish-onboarding-btn"
                className="w-2/3 min-h-[48px] py-3.5 rounded-2xl bg-[#8B0000] text-white text-sm font-semibold hover:bg-[#6D0000] transition-all flex items-center justify-center gap-2 shadow-xs btn-press"
              >
                <Check className="w-4 h-4" />
                <span>Start Tracking</span>
              </button>
            </div>
          </div>
        )}

        {/* Step indicator dots */}
        <div className="flex items-center justify-center gap-1.5 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                step === i ? 'w-6 bg-[#8B0000]' : 'w-1.5 bg-[#FCE4EC]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
