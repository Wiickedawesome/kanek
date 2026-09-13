import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { IconProps } from './index';

/** Car seat outline — used for per-seat pricing. */
export function Seat({ size = 24, color = '#656e5e', ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M7 4.5c-1.5 0-2 .9-2 2 0 2 .7 5.6 1 8 .2 1.6-.6 2.5-1.5 3.5-.8.9-.3 2.5 1.5 2.5h9c1.6 0 2.2-1.2 1.6-2.4-.5-1-1.1-1.8-.9-3.1.3-2.1 1-4.3 1-6.6 0-2-1-3.5-3-3.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
