import React from "react";

export default function BuddyServiceLogo({ className = "w-40 h-40" }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Circle - Gradient */}
      <defs>
        <linearGradient id="buddyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#23361A" />
          <stop offset="100%" stopColor="#6B8A2F" />
        </linearGradient>
        <linearGradient id="buddyGradient2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1a2614" />
          <stop offset="100%" stopColor="#4CAF50" />
        </linearGradient>
      </defs>

      {/* Background Circle */}
      <circle
        cx="100"
        cy="100"
        r="95"
        fill="url(#buddyGradient)"
        opacity="0.1"
      />
      <circle
        cx="100"
        cy="100"
        r="95"
        stroke="url(#buddyGradient)"
        strokeWidth="2"
        opacity="0.3"
      />

      {/* Main Logo Circle */}
      <circle cx="100" cy="100" r="85" fill="white" />
      <circle
        cx="100"
        cy="100"
        r="85"
        stroke="url(#buddyGradient)"
        strokeWidth="3"
      />

      {/* "B" Letter Design */}
      <g>
        {/* Left curved part */}
        <path
          d="M 70 55 L 85 55 Q 95 55 95 65 Q 95 73 85 75 L 70 75 Z"
          fill="url(#buddyGradient)"
        />

        {/* Middle vertical line */}
        <rect x="70" y="55" width="4" height="90" fill="url(#buddyGradient)" />

        {/* Top right curve */}
        <path
          d="M 74 55 Q 100 55 100 70 Q 100 80 85 82 L 74 82"
          fill="none"
          stroke="url(#buddyGradient)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Bottom right curve */}
        <path
          d="M 74 82 Q 105 82 105 100 Q 105 120 85 130 L 74 130"
          fill="none"
          stroke="url(#buddyGradient2)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Additional accent circles for modern look */}
        <circle cx="92" cy="68" r="2.5" fill="url(#buddyGradient)" />
        <circle cx="98" cy="100" r="2.5" fill="url(#buddyGradient2)" />
      </g>

      {/* Decorative dots */}
      <circle cx="130" cy="65" r="4" fill="url(#buddyGradient)" opacity="0.4" />
      <circle
        cx="128"
        cy="120"
        r="3.5"
        fill="url(#buddyGradient2)"
        opacity="0.4"
      />
    </svg>
  );
}
