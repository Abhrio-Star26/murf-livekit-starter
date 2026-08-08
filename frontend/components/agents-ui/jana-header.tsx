'use client';

import React, { useState } from 'react';
import { ShieldCheck, Bank, Sparkle, LockLaminated, Globe } from '@phosphor-icons/react';
import { useLanguage } from '@/components/app/language-context';
import { LanguageSelectorModal } from '@/components/agents-ui/language-selector-modal';
import { SUPPORTED_LANGUAGES } from '@/lib/translations';

interface JanaHeaderProps {
  onTopicClick?: (topic: string) => void;
}

export function JanaHeader({ onTopicClick }: JanaHeaderProps) {
  const { t, lang, setLang } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);

  const activeLang = SUPPORTED_LANGUAGES.find((l) => l.code === lang);

  const topics = [
    { label: t.topicsTitle1, icon: Bank },
    { label: t.topicsTitle2, icon: LockLaminated },
    { label: t.topicsTitle3, icon: Sparkle },
  ];

  return (
    <>
      <header className="w-full flex flex-col items-center justify-center pt-4 pb-2 px-4 space-y-3 border-b border-teal-900/40 bg-gradient-to-b from-slate-950 via-slate-900 to-transparent">
        {/* Brand Row */}
        <div className="w-full flex items-start justify-between">
          {/* App Name */}
          <div className="flex flex-col items-start space-y-0.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-teal-500 p-0.5 shadow-md shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center text-amber-400 font-bold text-[10px]">
                  जन
                </div>
              </div>
              <h1 className="text-lg md:text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-emerald-100 to-amber-200 tracking-tight leading-tight">
                {t.appName}
              </h1>
            </div>
            <p className="text-[11px] text-teal-300/80 font-medium pl-10">
              {t.appSubtitle}
            </p>
          </div>

          {/* Language Switcher Button */}
          <button
            onClick={() => setLangOpen(true)}
            className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-teal-900/60 border border-teal-800/50 hover:border-teal-500/60 text-slate-200 text-xs font-medium transition-all hover:scale-105 shadow-sm"
            aria-label={t.changeLanguage}
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold text-amber-300">{activeLang?.nativeName ?? 'EN'}</span>
            <span className="text-slate-400 hidden sm:inline">{t.changeLanguage}</span>
          </button>
        </div>

        {/* Trust Badge */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-teal-950/60 border border-teal-700/40 text-[11px] text-teal-200 shadow-inner w-full max-w-xl justify-center">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-center">{t.trustBadge}</span>
        </div>

        {/* Topic Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
          {topics.map((topic) => {
            const Icon = topic.icon;
            return (
              <button
                key={topic.label}
                onClick={() => onTopicClick?.(topic.label)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 hover:bg-teal-900/60 border border-teal-800/50 text-[11px] text-slate-200 transition-all hover:scale-105 hover:border-teal-500/60"
              >
                <Icon className="w-3.5 h-3.5 text-amber-400" />
                <span>{topic.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Language Modal */}
      <LanguageSelectorModal isOpen={langOpen} onClose={() => setLangOpen(false)} />
    </>
  );
}
