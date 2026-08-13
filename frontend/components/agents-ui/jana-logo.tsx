'use client';

import React from 'react';

interface JanaLogoProps {
  size?: number;
  className?: string;
}

export function JanaLogo({ size = 28, className = '' }: JanaLogoProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          {/* Vibrant multi-stop gradient for the outer ring */}
          <linearGradient id="jana-logo-ringGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#f59e0b" />
            <stop offset="35%"  stopColor="#10b981" />
            <stop offset="70%"  stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>

          {/* Deep bg fill */}
          <radialGradient id="jana-logo-bgGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#0f2027" />
            <stop offset="60%"  stopColor="#0a1628" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>

          {/* Glowing teal fill for the sprout/leaf */}
          <linearGradient id="jana-logo-leafGrad" x1="32" y1="22" x2="32" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          {/* Gold star gradient */}
          <linearGradient id="jana-logo-starGrad" x1="24" y1="16" x2="40" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>

          {/* Coin arc gradient */}
          <linearGradient id="jana-logo-coinGrad" x1="16" y1="40" x2="48" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="jana-logo-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Strong star glow */}
          <filter id="jana-logo-starGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Outer Gradient Ring ── */}
        <circle cx="32" cy="32" r="31" stroke="url(#jana-logo-ringGrad)" strokeWidth="2.5" fill="url(#jana-logo-bgGrad)" />

        {/* ── Inner ambient glow circle ── */}
        <circle cx="32" cy="32" r="26" fill="url(#jana-logo-bgGrad)" opacity="0.7" />

        {/* ── Rising Arc of Hope (upward growth arc) ── */}
        <path
          d="M16 44 Q20 20 32 14 Q44 20 48 44"
          stroke="url(#jana-logo-leafGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
          filter="url(#jana-logo-glow)"
        />
        <path
          d="M20 44 Q23 25 32 18 Q41 25 44 44"
          stroke="#34d399"
          strokeWidth="1"
          strokeLinecap="round"
          fill="rgba(16,185,129,0.08)"
          opacity="0.5"
        />

        {/* ── Sprouting Leaves (Hope & Empowerment) ── */}
        <path
          d="M32 42 C32 42 22 36 22 28 C22 24 26 22 29 26 C30.5 28 31 34 32 42Z"
          fill="url(#jana-logo-leafGrad)"
          filter="url(#jana-logo-glow)"
        />
        <path
          d="M32 42 C32 42 42 36 42 28 C42 24 38 22 35 26 C33.5 28 33 34 32 42Z"
          fill="#10b981"
          opacity="0.8"
          filter="url(#jana-logo-glow)"
        />

        {/* ── Coin of Financial Security (bottom) ── */}
        <ellipse cx="32" cy="48" rx="7" ry="4" fill="url(#jana-logo-coinGrad)" opacity="0.95" filter="url(#jana-logo-glow)" />
        <ellipse cx="32" cy="47" rx="7" ry="4" fill="#fcd34d" opacity="0.6" />
        <ellipse cx="30" cy="46.5" rx="2.5" ry="1.2" fill="white" opacity="0.25" />
        <text x="32" y="49.5" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#92400e" fontFamily="sans-serif">₹</text>

        {/* ── Central 4-Point Star Beacon (AI Guide / Voice Sakhi) ── */}
        <path
          d="M32 13 L33.6 18.5 L39.5 20 L33.6 21.5 L32 27 L30.4 21.5 L24.5 20 L30.4 18.5 Z"
          fill="url(#jana-logo-starGrad)"
          filter="url(#jana-logo-starGlow)"
        />

        {/* ── Smaller accent stars ── */}
        <path d="M48 22 L49 25 L52 26 L49 27 L48 30 L47 27 L44 26 L47 25 Z" fill="#f59e0b" opacity="0.8" filter="url(#jana-logo-starGlow)" />
        <path d="M16 22 L17 25 L20 26 L17 27 L16 30 L15 27 L12 26 L15 25 Z" fill="#06b6d4" opacity="0.8" filter="url(#jana-logo-starGlow)" />

        {/* ── Small sparkle dots around ring ── */}
        <circle cx="32" cy="4"  r="1.5" fill="#fbbf24" opacity="0.9" />
        <circle cx="55" cy="18" r="1"   fill="#10b981" opacity="0.9" />
        <circle cx="60" cy="36" r="0.8" fill="#06b6d4" opacity="0.7" />
        <circle cx="9"  cy="18" r="1"   fill="#a78bfa" opacity="0.8" />
        <circle cx="4"  cy="36" r="0.8" fill="#f59e0b" opacity="0.7" />
      </svg>
    </div>
  );
}
