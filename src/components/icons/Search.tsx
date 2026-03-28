import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import type { IconProps } from './index';

export function Search({ size = 24, color = '#656e5e', ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Circle cx={11} cy={11} r={8} stroke={color} strokeWidth={1.5} />
      <Path
        d="m21 21-4.35-4.35"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
