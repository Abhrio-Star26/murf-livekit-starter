'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChatTeardropText, CaretDown, CaretUp, User, Sparkle } from '@phosphor-icons/react';
import { cn } from '@/lib/shadcn/utils';
import { useLanguage } from '@/components/app/language-context';

export interface ChatMessage {
  id?: string;
  speaker: 'user' | 'agent';
  text: string;
  timestamp?: string;
}

interface TranscriptPanelProps {
  messages: ChatMessage[];
  agentState?: string;
  className?: string;
}

export function TranscriptPanel({ messages, agentState, className }: TranscriptPanelProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, agentState]);

  return (
    <div
      className={cn(
        'w-full max-w-2xl mx-auto rounded-2xl border border-teal-800/40 bg-slate-900/90 shadow-xl overflow-hidden transition-all duration-300 backdrop-blur-md',
        className
      )}
    >
      {/* Toggle Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-teal-900/40 cursor-pointer hover:bg-slate-950 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-teal-300">
          <ChatTeardropText className="w-4 h-4 text-amber-400" />
          <span>{t.transcriptTitle}</span>
          <span className="text-[10px] bg-teal-950 text-teal-400 border border-teal-700/50 px-2 py-0.5 rounded-full">
            {messages.length}
          </span>
        </div>
        <button className="text-slate-400 hover:text-slate-200 transition-colors">
          {isOpen ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Body */}
      {isOpen && (
        <div
          ref={scrollRef}
          className="h-48 md:h-56 overflow-y-auto p-4 space-y-3 scroll-smooth text-xs md:text-sm"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center space-y-1">
              <Sparkle className="w-6 h-6 text-amber-400/60 animate-pulse" />
              <p className="font-medium text-xs">{t.transcriptEmptyText}</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.speaker === 'user';
              return (
                <div
                  key={msg.id || idx}
                  className={cn(
                    'flex flex-col max-w-[85%] rounded-2xl px-4 py-2.5 space-y-1 shadow-sm',
                    isUser
                      ? 'ml-auto bg-teal-700 text-teal-50 rounded-br-none border border-teal-600/50'
                      : 'mr-auto bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/60'
                  )}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase opacity-85">
                    {isUser ? (
                      <>
                        <User className="w-3 h-3 text-teal-200" />
                        <span>{t.transcriptUser}</span>
                      </>
                    ) : (
                      <>
                        <Sparkle className="w-3 h-3 text-amber-400" />
                        <span>{t.transcriptAgent}</span>
                      </>
                    )}
                  </div>
                  <p className="leading-relaxed text-xs md:text-sm font-sans">{msg.text}</p>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
