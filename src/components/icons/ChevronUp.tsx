import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { IconProps } from './index';

export function ChevronUp({ size = 24, color = '#656e5e', ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="m18 15-6-6-6 6"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
