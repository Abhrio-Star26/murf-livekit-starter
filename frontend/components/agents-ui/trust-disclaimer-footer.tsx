'use client';

import React from 'react';
import { ShieldCheck, Info } from '@phosphor-icons/react';
import { useLanguage } from '@/components/app/language-context';

export function TrustDisclaimerFooter() {
  const { t } = useLanguage();

  return (
    <footer className="w-full py-3 px-4 bg-slate-950/90 border-t border-teal-900/30 text-slate-400 text-[11px] flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
      <div className="flex items-center gap-1.5 text-teal-400 font-medium">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>{t.disclaimerTitle}</span>
      </div>
      <div className="flex items-center gap-1 text-slate-400">
        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>{t.disclaimerWarning}</span>
      </div>
    </footer>
  );
}
