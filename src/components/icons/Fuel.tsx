import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { IconProps } from './index';

export function Fuel({ size = 24, color = '#656e5e', ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2 22h16M15 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9l-3.5-3.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 7h6v4H6z"
        stroke={color}
        strokeWidth={1.5}
      />
    </Svg>
  );
}
