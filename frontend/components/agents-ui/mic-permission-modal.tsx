'use client';

import React from 'react';
import { MicrophoneSlash, ShieldWarning, ArrowClockwise, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/app/language-context';

interface MicPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
}

export function MicPermissionModal({ isOpen, onClose, onRetry }: MicPermissionModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-teal-500/30 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-5">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <MicrophoneSlash className="w-7 h-7" />
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold text-slate-100">{t.micErrorTitle}</h3>
          <p className="text-sm text-amber-300 font-medium">{t.micErrorSubtitle}</p>
          <p className="text-xs text-slate-300 leading-relaxed pt-1">{t.micErrorDesc}</p>
        </div>

        {/* Steps */}
        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-3 text-xs text-slate-300">
          <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs uppercase tracking-wider">
            <ShieldWarning className="w-4 h-4" />
            <span>{t.micErrorStepTitle}</span>
          </div>
          <ol className="space-y-2.5 list-decimal list-inside text-slate-300 leading-relaxed">
            <li>{t.micErrorStep1}</li>
            <li>{t.micErrorStep2}</li>
            <li>{t.micErrorStep3}</li>
          </ol>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-slate-700 hover:bg-slate-800 text-slate-300 text-xs py-5 rounded-xl"
          >
            {t.cancelBtn}
          </Button>
          <Button
            onClick={onRetry}
            className="flex-1 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-semibold text-xs py-5 rounded-xl shadow-lg shadow-teal-950/50 flex items-center justify-center gap-2"
          >
            <ArrowClockwise className="w-4 h-4" />
            <span>{t.tryAgainBtn}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
