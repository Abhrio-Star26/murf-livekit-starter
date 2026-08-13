'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SakhiAvatar, SakhiState } from '@/components/agents-ui/sakhi-avatar';
import { JanaHeader } from '@/components/agents-ui/jana-header';
import { TrustDisclaimerFooter } from '@/components/agents-ui/trust-disclaimer-footer';
import { MicPermissionModal } from '@/components/agents-ui/mic-permission-modal';
import { TopicDetailModal, TopicCategory } from '@/components/agents-ui/topic-detail-modal';
import { useLanguage } from '@/components/app/language-context';
import { Microphone, PhoneCall, ArrowRight, ShieldCheck, Sparkle, Bank, PiggyBank } from '@phosphor-icons/react';
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
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TopicCategory>('schemes');

  const handleOpenTopic = (cat: TopicCategory) => {
    setSelectedCategory(cat);
    setTopicModalOpen(true);
  };

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
              className="w-full max-w-sm h-14 rounded-full bg-gradient-to-r from-teal-600 via-emerald-600 to-amber-600 hover:from-teal-500 hover:to-amber-500 text-white font-bold text-sm md:text-base tracking-wide shadow-xl shadow-teal-950/80 transition-all hover:scale-105 hover:shadow-[0_0_32px_6px_rgba(20,184,166,0.25)] flex items-center justify-center gap-3 border border-amber-300/40"
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
              className="w-full max-w-sm h-14 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-sm md:text-base tracking-wide shadow-xl transition-all hover:scale-105 hover:shadow-[0_0_28px_5px_rgba(20,184,166,0.22)] flex items-center justify-center gap-3 border border-teal-400/40"
            >
              <PhoneCall className="w-5 h-5 text-emerald-300" />
              <span>{t.endedBtn}</span>
            </Button>
          )}
        </div>

        {/* Topic Cards */}
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-300 max-w-xl w-full">
          <button
            onClick={() => handleOpenTopic('schemes')}
            className="p-3 rounded-xl bg-slate-900/90 border border-teal-800/60 hover:border-teal-500 text-center space-y-1 hover:bg-teal-950/40 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer shadow-md group"
          >
            <span className="text-amber-400 font-bold flex items-center justify-center gap-1 group-hover:text-amber-300">
              <Bank className="w-4 h-4 text-amber-400" />
              {t.topicsTitle1}
            </span>
            <span className="block text-slate-300 text-[10px]">{t.topicsDesc1}</span>
            <span className="inline-block pt-1 text-[10px] text-teal-400 font-semibold group-hover:underline">View Schemes →</span>
          </button>

          <button
            onClick={() => handleOpenTopic('scam')}
            className="p-3 rounded-xl bg-slate-900/90 border border-teal-800/60 hover:border-red-500/60 text-center space-y-1 hover:bg-red-950/30 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer shadow-md group"
          >
            <span className="text-amber-400 font-bold flex items-center justify-center gap-1 group-hover:text-amber-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {t.topicsTitle2}
            </span>
            <span className="block text-slate-300 text-[10px]">{t.topicsDesc2}</span>
            <span className="inline-block pt-1 text-[10px] text-red-400 font-semibold group-hover:underline">View Helpline (1930) →</span>
          </button>

          <button
            onClick={() => handleOpenTopic('savings')}
            className="p-3 rounded-xl bg-slate-900/90 border border-teal-800/60 hover:border-amber-500/60 text-center space-y-1 hover:bg-amber-950/30 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer shadow-md group"
          >
            <span className="text-amber-400 font-bold flex items-center justify-center gap-1 group-hover:text-amber-300">
              <PiggyBank className="w-4 h-4 text-amber-300" />
              {t.topicsTitle3}
            </span>
            <span className="block text-slate-300 text-[10px]">{t.topicsDesc3}</span>
            <span className="inline-block pt-1 text-[10px] text-amber-400 font-semibold group-hover:underline">View Policies →</span>
          </button>
        </div>
      </main>

      <TrustDisclaimerFooter />

      <TopicDetailModal
        isOpen={topicModalOpen}
        onClose={() => setTopicModalOpen(false)}
        initialTopic={selectedCategory}
        onStartCallWithTopic={() => {
          setTopicModalOpen(false);
          handleStartCallClick();
        }}
      />

      <MicPermissionModal
        isOpen={showMicError}
        onClose={() => setShowMicError(false)}
        onRetry={handleStartCallClick}
      />
    </div>
  );
};
