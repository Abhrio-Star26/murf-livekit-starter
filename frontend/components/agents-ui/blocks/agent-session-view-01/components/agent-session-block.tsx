'use client';

import React, { useState } from 'react';
import { useAgent, useSessionContext, useSessionMessages } from '@livekit/components-react';
import {
  AgentControlBar,
  type AgentControlBarControls,
} from '@/components/agents-ui/agent-control-bar';
import { SakhiAvatar, SakhiState } from '@/components/agents-ui/sakhi-avatar';
import { JanaHeader } from '@/components/agents-ui/jana-header';
import { TranscriptPanel, ChatMessage } from '@/components/agents-ui/transcript-panel';
import { TrustDisclaimerFooter } from '@/components/agents-ui/trust-disclaimer-footer';
import { useLanguage } from '@/components/app/language-context';
import { cn } from '@/lib/shadcn/utils';

export interface AgentSessionView_01Props {
  preConnectMessage?: string;
  supportsChatInput?: boolean;
  supportsVideoInput?: boolean;
  supportsScreenShare?: boolean;
  isPreConnectBufferEnabled?: boolean;
  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  audioVisualizerColor?: `#${string}`;
  audioVisualizerColorShift?: number;
  audioVisualizerBarCount?: number;
  audioVisualizerGridRowCount?: number;
  audioVisualizerGridColumnCount?: number;
  audioVisualizerRadialBarCount?: number;
  audioVisualizerRadialRadius?: number;
  audioVisualizerWaveLineWidth?: number;
  className?: string;
}

export function AgentSessionView_01({
  supportsChatInput = true,
  supportsVideoInput = false,
  supportsScreenShare = false,
  ref,
  className,
  ...props
}: React.ComponentProps<'section'> & AgentSessionView_01Props) {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [chatOpen, setChatOpen] = useState(true);
  const { state: agentState } = useAgent();
  const { t } = useLanguage();

  // Map Agent State to Sakhi State
  // State 3: Listening vs State 4: Speaking
  const currentSakhiState: SakhiState =
    agentState === 'speaking'
      ? 'speaking'
      : agentState === 'listening' || agentState === 'thinking' || agentState === 'idle'
      ? 'listening'
      : 'connecting';

  // Distinct color tint per state
  const stateBackgroundTints = {
    listening: 'bg-gradient-to-b from-emerald-950/40 via-slate-950 to-slate-950 border-emerald-500/30',
    speaking: 'bg-gradient-to-b from-sky-950/40 via-slate-950 to-slate-950 border-amber-400/30',
    connecting: 'bg-gradient-to-b from-amber-950/40 via-slate-950 to-slate-950 border-amber-500/30',
    ready: 'bg-slate-950',
    ended: 'bg-slate-900',
  };

  // Format LiveKit messages for Transcript Panel
  const formattedMessages: ChatMessage[] = messages.map((msg, index) => ({
    id: msg.id || `msg-${index}`,
    speaker: msg.from?.isLocal ? 'user' : 'agent',
    text: typeof msg.message === 'string' ? msg.message : String(msg.message ?? ''),
  }));

  const controls: AgentControlBarControls = {
    leave: true,
    microphone: true,
    chat: supportsChatInput,
    camera: supportsVideoInput,
    screenShare: supportsScreenShare,
  };

  return (
    <section
      ref={ref}
      className={cn(
        'relative z-10 h-full w-full overflow-y-auto flex flex-col justify-between text-slate-100 font-sans transition-colors duration-500',
        stateBackgroundTints[currentSakhiState],
        className
      )}
      {...props}
    >
      {/* Header */}
      <JanaHeader />

      {/* Center Active Call Area: Avatar + Dynamic Speaker Wave + Transcript */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 space-y-6 max-w-3xl mx-auto w-full">
        {/* Sakhi Avatar reacting to current voice state */}
        <SakhiAvatar state={currentSakhiState} size="md" />

        {/* Dynamic Speaker Indicator Text & State Callout */}
        <div
          className={cn(
            'text-center space-y-1.5 px-6 py-3 rounded-2xl border backdrop-blur-sm max-w-md w-full shadow-lg transition-all duration-300',
            currentSakhiState === 'speaking'
              ? 'bg-amber-950/40 border-amber-400/50 text-amber-100'
              : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100'
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <span
              className={cn(
                'w-3 h-3 rounded-full',
                currentSakhiState === 'speaking'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-emerald-400 animate-pulse'
              )}
            />
            <span className="text-sm md:text-base font-bold text-slate-100">
              {currentSakhiState === 'speaking' ? t.speakingState : t.listeningState}
            </span>
          </div>

          <p className="text-xs text-teal-300/80 font-medium">
            {currentSakhiState === 'speaking' ? t.speakingDesc : t.listeningDesc}
          </p>
        </div>

        {/* Live Conversation Transcript Panel */}
        <TranscriptPanel messages={formattedMessages} agentState={agentState} />

        {/* Control Bar (Leave, Mute, Chat Toggle) */}
        <div className="w-full max-w-md pb-2">
          <AgentControlBar
            variant="livekit"
            controls={controls}
            isChatOpen={chatOpen}
            isConnected={session.isConnected}
            onDisconnect={session.end}
            onIsChatOpenChange={setChatOpen}
          />
        </div>
      </main>

      {/* Footer */}
      <TrustDisclaimerFooter />
    </section>
  );
}
