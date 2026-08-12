'use client';

import React, { useState } from 'react';
import { ShieldCheck, Bank, Sparkle, LockLaminated, Globe, CaretDown } from '@phosphor-icons/react';
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
        {/* Brand & Language Header Row (Constrained on wide screens like 1440px+) */}
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 2xl:px-16 relative flex items-center justify-between min-h-[44px]">
          {/* Top Left: Google Translate style Custom Language Select Dropdown */}
          <div className="relative z-30">
            <button
              type="button"
              id="header-language-dropdown-btn"
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-2 bg-slate-800/95 hover:bg-teal-950/80 border border-teal-700/70 text-amber-300 text-xs font-bold px-3.5 py-2 rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
            >
              <Globe className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="flex items-center gap-1">
                <span className="text-slate-300 font-semibold">{t.changeLanguage}:</span>
                <span className="text-amber-300">{activeLang?.flag} {activeLang?.nativeName}</span>
              </span>
              <CaretDown className={`w-3.5 h-3.5 text-amber-400 shrink-0 transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Options Menu */}
            {langOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setLangOpen(false)}
                />
                <div className="absolute left-0 mt-1.5 w-48 bg-slate-900 border border-teal-700/60 rounded-xl shadow-2xl overflow-hidden z-30 py-1 divide-y divide-slate-800/50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-950/40">
                    {t.selectLanguage}
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {SUPPORTED_LANGUAGES.map((option) => {
                      const isSelected = option.code === lang;
                      return (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => {
                            setLang(option.code);
                            setLangOpen(false);
                          }}
                          className={`w-full text-left flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                            isSelected
                              ? 'bg-teal-900/60 text-amber-300 font-bold'
                              : 'text-slate-200 hover:bg-slate-800/80'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{option.flag}</span>
                            <span>{option.nativeName}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">{option.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Top Middle: App Title (Jana Sakhyam) Centered */}
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center text-center">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-teal-500 p-0.5 shadow-md shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center text-amber-400 font-bold text-[9px]">
                  जन
                </div>
              </div>
              <h1 className="text-lg md:text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-emerald-100 to-amber-200 tracking-tight leading-tight whitespace-nowrap">
                {t.appName}
              </h1>
            </div>
            <p className="text-[10px] md:text-[11px] text-teal-300/80 font-medium hidden sm:block">
              {t.appSubtitle}
            </p>
          </div>

          {/* Right Spacer / Balance element */}
          <div className="w-10 sm:w-24 shrink-0" />
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
    </>
  );
}
