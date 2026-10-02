/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useSecurity } from '../security/SecurityContext';
import { migrationOrchestrator } from '../storage/migrationOrchestrator';
import { ShieldCheck, Lock, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMigrationComplete?: () => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({
  isOpen,
  onClose,
  onMigrationComplete,
}) => {
  const { withUnlockedKey } = useSecurity();
  const [status, setStatus] = useState<'idle' | 'migrating' | 'success' | 'failure'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleStartMigration = async () => {
    setStatus('migrating');
    setErrorMsg('');

    try {
      const result = await withUnlockedKey(async (key) => {
        return await migrationOrchestrator.executeControlledMigration(key);
      });

      if (result.status === 'SUCCESS' || result.status === 'ALREADY_COMPLETED') {
        setStatus('success');
        if (onMigrationComplete) {
          onMigrationComplete();
        }
      } else {
        setStatus('failure');
        setErrorMsg(result.message || 'Your existing data was kept safe. The secure migration could not be completed.');
      }
    } catch (err) {
      setStatus('failure');
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Your existing data was kept safe. The secure migration could not be completed.'
      );
    }
  };

  const handleDismiss = () => {
    migrationOrchestrator.dismissPrompt();
    onClose();
  };

  return (
    <div
      id="migration-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="migration-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs transition-all"
    >
      <div
        id="migration-modal"
        className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-8 max-h-[90dvh] overflow-y-auto shadow-2xl border border-[#F5E6E8] relative text-center space-y-5 sm:space-y-6 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Glow decoration */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#FCE4EC] rounded-full blur-2xl opacity-60 pointer-events-none" />

        {/* State Icon */}
        <div className="w-16 h-16 rounded-3xl bg-[#FFF0F4] text-[#8B0000] flex items-center justify-center mx-auto shadow-xs border border-[#FCE4EC]">
          {status === 'idle' && <ShieldCheck className="w-8 h-8" />}
          {status === 'migrating' && <Lock className="w-8 h-8 animate-pulse text-[#8B0000]" />}
          {status === 'success' && <CheckCircle2 className="w-8 h-8 text-[#2E7D32]" />}
          {status === 'failure' && <AlertCircle className="w-8 h-8 text-[#B71C1C]" />}
        </div>

        {/* Idle Mode: Prompt */}
        {status === 'idle' && (
          <>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-serif text-[#2B171B]">
                Upgrade to Encrypted Vault
              </h2>
              <p className="text-xs sm:text-sm text-[#795B62] leading-relaxed">
                Your existing cycle data is stored in the older local storage format. We can securely move it into your private AES-256 encrypted vault.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FFF8FA] border border-[#F3E5E8] text-left text-xs text-[#795B62] space-y-1.5">
              <div className="font-semibold text-[#2B171B] flex items-center gap-1.5">
                <span>🛡️ Safe, Verified Migration</span>
              </div>
              <p>
                Your existing data will only be removed after the migration is fully verified and confirmed readable.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                id="migrate-not-now-btn"
                onClick={handleDismiss}
                className="w-full sm:w-1/2 min-h-[44px] py-3 rounded-xl border border-[#F3E5E8] bg-white text-[#795B62] text-xs font-semibold hover:bg-[#FFF8FA] hover:text-[#2B171B] transition-colors btn-press flex items-center justify-center"
              >
                Not Now
              </button>
              <button
                type="button"
                id="migrate-securely-btn"
                onClick={handleStartMigration}
                className="w-full sm:w-1/2 min-h-[44px] py-3 rounded-xl bg-[#8B0000] text-white text-xs font-semibold hover:bg-[#6D0000] transition-all shadow-xs flex items-center justify-center gap-1.5 btn-press"
              >
                <span>Migrate Securely</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}

        {/* Migrating Mode: Progress */}
        {status === 'migrating' && (
          <div id="migration-in-progress" className="space-y-4 py-4">
            <h2 className="text-xl font-bold font-serif text-[#2B171B]">
              Securing your data…
            </h2>
            <p className="text-xs text-[#795B62]">
              Encrypting records and verifying vault integrity. Please keep this window open.
            </p>
            <div className="w-full bg-[#FFF0F4] rounded-full h-2 overflow-hidden">
              <div className="bg-[#8B0000] h-full w-2/3 rounded-full animate-pulse" />
            </div>
          </div>
        )}

        {/* Success Mode */}
        {status === 'success' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-serif text-[#2B171B]">
                Migration Complete
              </h2>
              <p className="text-xs sm:text-sm text-[#795B62] leading-relaxed">
                Your data has been securely moved to your private vault. Old plaintext local storage records have been safely cleared.
              </p>
            </div>

            <button
              type="button"
              id="migration-success-btn"
              onClick={onClose}
              className="w-full min-h-[48px] py-3.5 rounded-2xl bg-[#8B0000] text-white text-sm font-semibold hover:bg-[#6D0000] transition-all shadow-xs btn-press"
            >
              Continue to App
            </button>
          </div>
        )}

        {/* Failure Mode */}
        {status === 'failure' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-serif text-[#2B171B]">
                Migration Incomplete
              </h2>
              <p className="text-xs sm:text-sm text-[#795B62] leading-relaxed">
                Your existing data was kept safe. The secure migration could not be completed. You can try again.
              </p>
              {errorMsg && (
                <p className="text-xs text-[#B71C1C] bg-[#FFF0F2] p-2.5 rounded-xl border border-[#FFCDD2]">
                  {errorMsg}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                id="migration-close-btn"
                onClick={onClose}
                className="w-full sm:w-1/2 min-h-[44px] py-3 rounded-xl border border-[#F3E5E8] bg-white text-[#795B62] text-xs font-semibold hover:bg-[#FFF8FA] transition-colors btn-press flex items-center justify-center"
              >
                Close
              </button>
              <button
                type="button"
                id="migration-retry-btn"
                onClick={handleStartMigration}
                className="w-full sm:w-1/2 min-h-[44px] py-3 rounded-xl bg-[#8B0000] text-white text-xs font-semibold hover:bg-[#6D0000] transition-all shadow-xs btn-press flex items-center justify-center"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
