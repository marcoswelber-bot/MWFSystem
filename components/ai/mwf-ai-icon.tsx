import * as React from "react";
import { cn } from "@/lib/utils";

type MwfAiIconProps = React.SVGProps<SVGSVGElement> & {
  available?: boolean;
};

export function MwfAiIcon({ available = true, className, ...props }: MwfAiIconProps) {
  const gradientId = React.useId().replaceAll(":", "");
  return (
    <svg viewBox="0 0 96 96" role="img" aria-label="MWF IA" className={cn("overflow-visible", className)} {...props}>
      <defs>
        <linearGradient id={gradientId} x1="12" y1="16" x2="84" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1688ff" />
          <stop offset=".48" stopColor="#16bde7" />
          <stop offset="1" stopColor="#41e596" />
        </linearGradient>
        <filter id={`${gradientId}-shadow`} x="-25%" y="-25%" width="150%" height="160%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#0f5fa8" floodOpacity=".24" />
        </filter>
      </defs>
      <path
        d="M48 9C25.4 9 9 24.7 9 45.8c0 12.9 6.2 23.9 16.5 30.4l-1.7 11.5c-.2 1.5 1.4 2.5 2.7 1.7l11.6-7.5c3.2.7 6.5 1.1 9.9 1.1 23 0 39-15.4 39-37.2C87 24.6 70.5 9 48 9Z"
        fill={`url(#${gradientId})`}
        filter={`url(#${gradientId}-shadow)`}
      />
      <path d="M49 27v36M40 32h18M40 42h18M40 52h18M40 62h18" fill="none" stroke="#087db9" strokeWidth="6" strokeLinecap="round" />
      <path d="M24 61c6.8 8.3 15.1 12.4 25 12.4 14.8 0 24.8-8.5 28-24.4" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" />
      <path d="M24 61c2.6 3.2 5.4 5.8 8.5 7.8" fill="none" stroke="#51ed9b" strokeWidth="6" strokeLinecap="round" />
      {available ? <circle cx="78" cy="18" r="10" fill="#2ddd87" stroke="white" strokeWidth="4" /> : null}
    </svg>
  );
}
