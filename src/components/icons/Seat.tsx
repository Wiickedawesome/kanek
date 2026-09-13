import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { IconProps } from './index';

/** Car seat outline — used for per-seat pricing. */
export function Seat({ size = 24, color = '#656e5e', ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M8.6 3.2v2.6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M9.6 4.6c-1 0-1.7.75-1.7 1.75 0 2.4.65 5.4 1.05 7.55.2 1.1-.25 1.65-1.15 2.3l3.1 1h6.05c1 0 1.75-.7 1.75-1.6s-.75-1.55-1.65-1.55h-5.5c-.9 0-1.4-.6-1.2-1.5.4-1.9 1-4.1 1-6.35 0-1-.7-1.6-1.75-1.6Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5.5 20.6h13.2"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
