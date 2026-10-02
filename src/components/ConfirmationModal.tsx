/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmStyle?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  confirmStyle = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="confirmation-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity"
    >
      <div
        id="confirmation-modal"
        className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#F5E6E8] space-y-4 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-2xl bg-[#FFF0F2] text-[#B71C1C] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#795B62] hover:text-[#2B171B] btn-press transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h3 className="text-lg font-bold text-[#2B171B] font-serif">{title}</h3>
          <p className="text-xs text-[#795B62] mt-1 leading-relaxed">{message}</p>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            id="confirmation-cancel-btn"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold text-[#795B62] hover:bg-[#FFF0F4] btn-press transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirmation-confirm-btn"
            onClick={onConfirm}
            className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-colors btn-press ${
              confirmStyle === 'danger'
                ? 'bg-[#B71C1C] hover:bg-[#8E1010]'
                : 'bg-[#8B0000] hover:bg-[#6D0000]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
