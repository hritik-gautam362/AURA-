/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useSecurity } from '../security/SecurityContext';
import { validatePin } from '../security/keyManager';
import { Lock, ShieldCheck, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const LockScreen: React.FC = () => {
  const { lockState, isInitialized, setupVault, unlock } = useSecurity();

  // Unlock mode state
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Setup mode state (for uninitialized vault)
  const [setupPin, setSetupPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupError, setSetupError] = useState('');

  const isSetupMode = !isInitialized || lockState === 'uninitialized';

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length < 6) {
      setErrorMsg('Please enter your 6-digit PIN.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await unlock(pin);
      setPin('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to unlock the private vault.');
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');

    const validation = validatePin(setupPin);
    if (!validation.valid) {
      setSetupError(validation.error || 'PIN does not meet security requirements.');
      return;
    }

    if (setupPin !== confirmPin) {
      setSetupError('PINs do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);

    try {
      await setupVault(setupPin);
      setSetupPin('');
      setConfirmPin('');
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Failed to initialize vault.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="app-lock-screen"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#FFF8FA] text-[#2B171B] font-sans selection:bg-[#FCE4EC] selection:text-[#8B0000]"
    >
      {/* Decorative background aura blooms */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#FCE4EC] rounded-full blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[#FFF0F4] rounded-full blur-3xl opacity-60 pointer-events-none" />

      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-[#F5E6E8] text-center space-y-6">
        {/* Vault Icon Header */}
        <div className="w-16 h-16 rounded-3xl bg-[#FFF0F4] text-[#8B0000] flex items-center justify-center mx-auto shadow-xs border border-[#FCE4EC]">
          {isSetupMode ? <ShieldCheck className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#2B171B]">
            {isSetupMode ? 'Secure Your Vault' : 'Orienta Vault Locked'}
          </h1>
          <p className="text-xs sm:text-sm text-[#795B62] max-w-xs mx-auto leading-relaxed">
            {isSetupMode
              ? 'Create a 6-digit numeric PIN to establish your private AES-256 encrypted vault.'
              : 'Your cycle history, intimate symptoms, and notes are encrypted. Enter your PIN to continue.'}
          </p>
        </div>

        {/* Setup Form (First-time initialization) */}
        {isSetupMode ? (
          <form onSubmit={handleSetup} className="space-y-4 text-left">
            <div className="space-y-1">
              <label
                htmlFor="vault-setup-pin"
                className="block text-xs font-semibold text-[#795B62] uppercase tracking-wider"
              >
                Create 6-Digit PIN
              </label>
              <input
                id="vault-setup-pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={setupPin}
                onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full px-4 py-3 rounded-2xl border border-[#F3E5E8] bg-white text-center text-lg tracking-widest text-[#2B171B] font-mono focus:outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000]"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="vault-confirm-pin"
                className="block text-xs font-semibold text-[#795B62] uppercase tracking-wider"
              >
                Confirm PIN
              </label>
              <input
                id="vault-confirm-pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full px-4 py-3 rounded-2xl border border-[#F3E5E8] bg-white text-center text-lg tracking-widest text-[#2B171B] font-mono focus:outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000]"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[#795B62] pt-1">
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="flex items-center gap-1.5 hover:text-[#2B171B] transition-colors"
              >
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPin ? 'Hide Digits' : 'Show Digits'}</span>
              </button>
              <span className="text-[11px] text-[#A88B92]">6 digits minimum</span>
            </div>

            {setupError && (
              <div
                id="vault-setup-error"
                className="p-3 bg-[#FFF0F2] border border-[#FFCDD2] rounded-xl text-xs font-semibold text-[#B71C1C] flex items-center gap-2 animate-in fade-in duration-150"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{setupError}</span>
              </div>
            )}

            <button
              id="vault-setup-btn"
              type="submit"
              disabled={isSubmitting || setupPin.length < 6 || confirmPin.length < 6}
              className="w-full py-3.5 rounded-2xl bg-[#8B0000] text-white text-sm font-semibold hover:bg-[#6D0000] disabled:bg-[#D0B8BE] disabled:cursor-not-allowed transition-all shadow-xs flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Deriving Key & Initializing...</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Establish Private Vault</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Unlock Form (Existing vault) */
          <form onSubmit={handleUnlock} className="space-y-5">
            <div className="relative">
              <input
                id="vault-pin-input"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full px-4 py-3.5 rounded-2xl border border-[#F3E5E8] bg-white text-center text-xl tracking-widest text-[#2B171B] font-mono focus:outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000]"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#795B62] hover:text-[#2B171B] transition-colors p-1"
                aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {errorMsg && (
              <div
                id="vault-unlock-error"
                className="p-3 bg-[#FFF0F2] border border-[#FFCDD2] rounded-xl text-xs font-semibold text-[#B71C1C] flex items-center gap-2 animate-in fade-in duration-150 text-left"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              id="vault-unlock-btn"
              type="submit"
              disabled={isSubmitting || pin.length < 6}
              className="w-full py-3.5 rounded-2xl bg-[#8B0000] text-white text-sm font-semibold hover:bg-[#6D0000] disabled:bg-[#D0B8BE] disabled:cursor-not-allowed transition-all shadow-xs flex items-center justify-center gap-2 active:scale-98"
            >
              {isSubmitting ? (
                <span>Authenticating & Decrypting...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Unlock Vault</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Security Assurance Footer */}
        <div className="pt-2 border-t border-[#F5E6E8] text-[11px] text-[#A88B92] leading-tight">
          🔒 Your data stays private on this device.
        </div>
      </div>
    </div>
  );
};
