'use client';

import React from 'react';
import { X, Check, Globe } from '@phosphor-icons/react';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/lib/translations';
import { useLanguage } from '@/components/app/language-context';
import { cn } from '@/lib/shadcn/utils';

interface LanguageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LanguageSelectorModal({ isOpen, onClose }: LanguageSelectorModalProps) {
  const { lang, setLang, t } = useLanguage();

  if (!isOpen) return null;

  const handleSelect = (code: LanguageCode) => {
    setLang(code);
    onClose();
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-sm bg-slate-900 border border-teal-700/40 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/60 border-b border-teal-900/40">
          <div className="flex items-center gap-2 text-teal-200 font-semibold text-sm">
            <Globe className="w-4 h-4 text-amber-400" />
            <span>{t.selectLanguage}</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors rounded-full p-1 hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Language Grid */}
        <div className="grid grid-cols-2 gap-2 p-4">
          {SUPPORTED_LANGUAGES.map((option) => {
            const isActive = lang === option.code;
            return (
              <button
                key={option.code}
                onClick={() => handleSelect(option.code)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-1.5 rounded-xl px-3 py-4 border transition-all duration-200 text-center group hover:scale-[1.03] active:scale-[0.98]',
                  isActive
                    ? 'bg-teal-800/80 border-teal-400/60 text-teal-50 shadow-lg shadow-teal-950/40'
                    : 'bg-slate-800/60 border-slate-700/50 text-slate-200 hover:bg-slate-800 hover:border-teal-700/50'
                )}
              >
                {/* Active check */}
                {isActive && (
                  <span className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white">
                    <Check className="w-3 h-3" weight="bold" />
                  </span>
                )}

                {/* Flag + Native Name */}
                <span className="text-2xl leading-none">{option.flag}</span>
                <span
                  className={cn(
                    'text-base font-bold leading-tight',
                    isActive ? 'text-amber-200' : 'text-slate-100'
                  )}
                >
                  {option.nativeName}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">{option.name}</span>
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="px-5 pb-4 text-center text-[11px] text-slate-500">
          Tap a language — all text on screen will switch instantly.
        </div>
      </div>
    </div>
  );
}
