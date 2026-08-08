'use client';

import { useState, useCallback } from 'react';
import { SakhiState } from '@/components/agents-ui/sakhi-avatar';
import { ChatMessage } from '@/components/agents-ui/transcript-panel';

export interface UseJanaVoiceAgentOptions {
  onStart?: () => void;
  onMicPermissionError?: (error: Error) => void;
  onStateChange?: (newState: SakhiState) => void;
  onTranscriptUpdate?: (messages: ChatMessage[]) => void;
}

export function useJanaVoiceAgent(options?: UseJanaVoiceAgentOptions) {
  const [state, setState] = useState<SakhiState>('ready');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [micBlocked, setMicBlocked] = useState(false);

  const changeState = useCallback(
    (newState: SakhiState) => {
      setState(newState);
      options?.onStateChange?.(newState);
    },
    [options]
  );

  const addTranscriptMessage = useCallback(
    (speaker: 'user' | 'agent', text: string) => {
      const newMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random()}`,
        speaker,
        text,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => {
        const updated = [...prev, newMsg];
        options?.onTranscriptUpdate?.(updated);
        return updated;
      });
    },
    [options]
  );

  const startSession = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      setMicBlocked(false);
      changeState('connecting');
      options?.onStart?.();

      // Simulated auto transition to listening if standalone
      setTimeout(() => {
        changeState('listening');
      }, 1500);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Microphone permission blocked');
      setMicBlocked(true);
      options?.onMicPermissionError?.(error);
    }
  }, [changeState, options]);

  const endSession = useCallback(() => {
    changeState('ended');
  }, [changeState]);

  return {
    state,
    messages,
    micBlocked,
    setMicBlocked,
    startSession,
    endSession,
    changeState,
    addTranscriptMessage,
  };
}
