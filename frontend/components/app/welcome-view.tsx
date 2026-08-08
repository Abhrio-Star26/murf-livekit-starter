'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SakhiAvatar, SakhiState } from '@/components/agents-ui/sakhi-avatar';
import { JanaHeader } from '@/components/agents-ui/jana-header';
import { TrustDisclaimerFooter } from '@/components/agents-ui/trust-disclaimer-footer';
import { MicPermissionModal } from '@/components/agents-ui/mic-permission-modal';
import { useLanguage } from '@/components/app/language-context';
import { Microphone, PhoneCall, ArrowRight, ShieldCheck, Sparkle } from '@phosphor-icons/react';
import { cn } from '@/lib/shadcn/utils';

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
  onMicPermissionError?: (err: Error) => void;
  isConnecting?: boolean;
  hasCallEnded?: boolean;
}

export const WelcomeView = ({
  onStartCall,
  onMicPermissionError,
  isConnecting = false,
  hasCallEnded = false,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const { t } = useLanguage();
  const [showMicError, setShowMicError] = useState(false);

  const currentState: SakhiState = isConnecting
    ? 'connecting'
    : hasCallEnded
    ? 'ended'
    : 'ready';

  const backgroundTints = {
    ready:       'bg-slate-950',
    connecting:  'bg-gradient-to-b from-amber-950/30 via-slate-950 to-slate-950',
    listening:   'bg-gradient-to-b from-emerald-950/40 via-slate-950 to-slate-950',
    speaking:    'bg-gradient-to-b from-sky-950/40 via-slate-950 to-slate-950',
    ended:       'bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950',
  };

  const handleStartCallClick = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      onStartCall();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Microphone permission blocked');
      setShowMicError(true);
      onMicPermissionError?.(error);
    }
  };

  return (
    <div
      ref={ref}
      className={cn(
        'min-h-svh w-full flex flex-col justify-between text-slate-100 font-sans transition-colors duration-500',
        backgroundTints[currentState]
      )}
    >
      <JanaHeader />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 text-center space-y-6 max-w-xl mx-auto w-full">
        <SakhiAvatar state={currentState} size="lg" />

        {/* State Banner */}
        <div className="space-y-2 max-w-prose">
          <h2 className="text-xl md:text-2xl font-bold text-slate-100">
            {currentState === 'ready'      && t.readyTitle}
            {currentState === 'connecting' && t.connectingTitle}
            {currentState === 'ended'      && t.endedTitle}
          </h2>
          <p className="text-xs md:text-sm text-teal-300/90 leading-relaxed font-medium">
            {currentState === 'ready'      && t.readyDesc}
            {currentState === 'connecting' && t.connectingDesc}
            {currentState === 'ended'      && t.endedDesc}
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2 w-full flex justify-center">
          {currentState === 'ready' && (
            <Button
              size="lg"
              onClick={handleStartCallClick}
              className="w-full max-w-sm h-14 rounded-full bg-gradient-to-r from-teal-600 via-emerald-600 to-amber-600 hover:from-teal-500 hover:to-amber-500 text-white font-bold text-sm md:text-base tracking-wide shadow-xl shadow-teal-950/80 transition-all hover:scale-105 flex items-center justify-center gap-3 border border-amber-300/40"
            >
              <Microphone className="w-5 h-5 text-amber-200 animate-pulse" />
              <span>{t.startCallBtn}</span>
              <ArrowRight className="w-5 h-5" />
            </Button>
          )}

          {currentState === 'connecting' && (
            <Button
              size="lg"
              disabled
              className="w-full max-w-sm h-14 rounded-full bg-amber-600/70 text-white font-semibold text-sm cursor-not-allowed flex items-center justify-center gap-3 border border-amber-400/50 shadow-lg shadow-amber-950/60"
            >
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>{t.connectingBtn}</span>
            </Button>
          )}

          {currentState === 'ended' && (
            <Button
              size="lg"
              onClick={handleStartCallClick}
              className="w-full max-w-sm h-14 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-sm md:text-base tracking-wide shadow-xl transition-all hover:scale-105 flex items-center justify-center gap-3 border border-teal-400/40"
            >
              <PhoneCall className="w-5 h-5 text-emerald-300" />
              <span>{t.endedBtn}</span>
            </Button>
          )}
        </div>

        {/* Topic Cards */}
        <div className="pt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-300 max-w-md w-full">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-teal-800/40 text-center space-y-0.5">
            <span className="text-amber-400 font-semibold flex items-center justify-center gap-1">
              <Sparkle className="w-3.5 h-3.5" />
              {t.topicsTitle1}
            </span>
            <span>{t.topicsDesc1}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-teal-800/40 text-center space-y-0.5">
            <span className="text-amber-400 font-semibold flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              {t.topicsTitle2}
            </span>
            <span>{t.topicsDesc2}</span>
          </div>
        </div>
      </main>

      <TrustDisclaimerFooter />

      <MicPermissionModal
        isOpen={showMicError}
        onClose={() => setShowMicError(false)}
        onRetry={handleStartCallClick}
      />
    </div>
  );
};
