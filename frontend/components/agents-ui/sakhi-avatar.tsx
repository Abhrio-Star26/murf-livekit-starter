'use client';

import React from 'react';
import { cn } from '@/lib/shadcn/utils';
import { useLanguage } from '@/components/app/language-context';

export type SakhiState = 'ready' | 'connecting' | 'listening' | 'speaking' | 'ended';

interface SakhiAvatarProps {
  state: SakhiState;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SakhiAvatar({ state, className, size = 'lg' }: SakhiAvatarProps) {
  const { t } = useLanguage();
  const sizeClasses = {
    sm: 'w-24 h-24',
    md: 'w-36 h-36',
    lg: 'w-48 h-48 md:w-56 md:h-56',
  };

  const borderStyles = {
    ready: 'border-amber-500/40 shadow-lg shadow-teal-950/20 ring-4 ring-teal-500/20 animate-sakhi-float',
    connecting: 'border-amber-500 ring-4 ring-amber-500/40 animate-sakhi-connecting',
    listening: 'border-emerald-500 ring-8 ring-emerald-500/30 animate-sakhi-listening',
    speaking: 'border-amber-400 ring-8 ring-amber-400/40 animate-sakhi-speaking',
    ended: 'border-slate-400 opacity-80 ring-2 ring-slate-400/20',
  };

  const badgeColors = {
    ready: 'bg-teal-700/90 text-teal-50 border-teal-500/30',
    connecting: 'bg-amber-600/90 text-amber-50 border-amber-400/50 animate-pulse',
    listening: 'bg-emerald-600/90 text-emerald-50 border-emerald-400/50',
    speaking: 'bg-amber-600/90 text-amber-50 border-amber-300/60',
    ended: 'bg-slate-700/90 text-slate-200 border-slate-500/30',
  };

  // Translated badge labels — update when language changes
  const badgeLabels = {
    ready: t.readyTitle.split(' ').slice(0, 2).join(' '),
    connecting: t.connectingBtn,
    listening: t.listeningState,
    speaking: t.speakingState,
    ended: t.endedTitle,
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      {/* Avatar Container with glowing rings */}
      <div className="relative group/avatar">
        {/* Outer Aura Ring */}
        <div
          className={cn(
            'relative overflow-hidden rounded-full border-4 transition-all duration-500 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900',
            'group-hover/avatar:shadow-[0_0_28px_4px_rgba(20,184,166,0.22)] group-hover/avatar:ring-teal-400/30',
            sizeClasses[size],
            borderStyles[state]
          )}
        >
          {/* Sakhi Illustration Graphic (Warm, approachable Indian financial guide) */}
          <svg
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full transform transition-transform duration-500 hover:scale-105"
          >
            <defs>
              <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0f4c5c" />
                <stop offset="50%" stopColor="#0d9488" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="sareeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
              <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f5d0a9" />
                <stop offset="100%" stopColor="#e5b382" />
              </linearGradient>
            </defs>

            {/* Background Circle */}
            <circle cx="100" cy="100" r="100" fill="url(#bgGrad)" />

            {/* Background Subtle Financial Radial Rays */}
            <circle cx="100" cy="100" r="85" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 6" opacity="0.25" />

            {/* Shoulders & Traditional Attire */}
            <path
              d="M30 185 C30 145 60 130 100 130 C140 130 170 145 170 185 Z"
              fill="url(#sareeGrad)"
            />
            {/* Elegant Saree Pallu Accent */}
            <path
              d="M60 135 Q90 150 120 185 L145 185 Q110 145 75 130 Z"
              fill="#0d9488"
              opacity="0.9"
            />
            {/* Saffron Border Trim */}
            <path
              d="M75 130 Q105 145 135 185"
              stroke="#fbbf24"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Neck */}
            <path d="M85 115 H115 V138 H85 Z" fill="url(#skinGrad)" />

            {/* Face Oval */}
            <ellipse cx="100" cy="90" rx="38" ry="44" fill="url(#skinGrad)" />

            {/* Hair Frame */}
            <path
              d="M60 85 C58 52 80 40 100 40 C120 40 142 52 140 85 C140 70 125 50 100 50 C75 50 60 70 60 85 Z"
              fill="#1e293b"
            />
            <path
              d="M62 82 Q100 68 138 82 Q135 48 100 48 Q65 48 62 82 Z"
              fill="#0f172a"
            />

            {/* Bindi (Traditional Trust & Warmth Symbol) */}
            <circle cx="100" cy="74" r="3" fill="#dc2626" />

            {/* Gentle Friendly Eyes */}
            <ellipse cx="84" cy="88" rx="5.5" ry="4" fill="#0f172a" />
            <ellipse cx="116" cy="88" rx="5.5" ry="4" fill="#0f172a" />
            <circle cx="86" cy="86.5" r="1.5" fill="#ffffff" />
            <circle cx="118" cy="86.5" r="1.5" fill="#ffffff" />
            {/* Eyebrows */}
            <path d="M76 80 Q84 76 92 80" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M108 80 Q116 76 124 80" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" fill="none" />

            {/* Nose */}
            <path d="M100 88 Q98 96 102 97" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.6" />

            {/* Smile / Mouth (Animated on speaking) */}
            {state === 'speaking' ? (
              <path
                d="M86 106 Q100 118 114 106 Q100 114 86 106 Z"
                fill="#b91c1c"
                className="animate-pulse"
              />
            ) : (
              <path
                d="M87 106 Q100 114 113 106"
                stroke="#b91c1c"
                strokeWidth="2.8"
                strokeLinecap="round"
                fill="none"
              />
            )}

            {/* Subtle Earrings */}
            <circle cx="60" cy="94" r="3.5" fill="#fbbf24" />
            <circle cx="140" cy="94" r="3.5" fill="#fbbf24" />
          </svg>

          {/* Dynamic State Overlay Effects */}
          {state === 'listening' && (
            <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none rounded-full animate-pulse" />
          )}
          {state === 'speaking' && (
            <div className="absolute inset-0 bg-amber-500/10 pointer-events-none rounded-full animate-pulse" />
          )}
        </div>

        {/* Live Audio Equalizer Wave Badge on Avatar when Speaking */}
        {state === 'speaking' && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900/90 border border-amber-400/60 px-3 py-1 rounded-full shadow-lg backdrop-blur-sm">
            <span className="w-1 bg-amber-400 rounded-full animate-eq-1" />
            <span className="w-1 bg-amber-300 rounded-full animate-eq-2" />
            <span className="w-1 bg-amber-500 rounded-full animate-eq-3" />
            <span className="w-1 bg-amber-200 rounded-full animate-eq-4" />
            <span className="w-1 bg-amber-400 rounded-full animate-eq-5" />
          </div>
        )}

        {/* Listening Waveform Indicator around avatar */}
        {state === 'listening' && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-teal-950/90 border border-emerald-400/60 px-3 py-1 rounded-full shadow-lg backdrop-blur-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-medium text-emerald-200 tracking-wide uppercase">
              Listening / सुन रहे हैं
            </span>
          </div>
        )}
      </div>

      {/* State Badge Label below Avatar */}
      <div
        className={cn(
          'px-4 py-1.5 rounded-full text-xs md:text-sm font-semibold border shadow-sm transition-all duration-300 flex items-center gap-2',
          badgeColors[state]
        )}
      >
        <span
          className={cn(
            'w-2 h-2 rounded-full',
            state === 'ready' && 'bg-teal-300',
            state === 'connecting' && 'bg-amber-300 animate-ping',
            state === 'listening' && 'bg-emerald-300 animate-pulse',
            state === 'speaking' && 'bg-amber-300 animate-pulse',
            state === 'ended' && 'bg-slate-400'
          )}
        />
        {badgeLabels[state]}
      </div>
    </div>
  );
}
