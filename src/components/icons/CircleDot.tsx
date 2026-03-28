import React from 'react';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import type { IconProps } from './index';

export function CircleDot({ size = 24, color = '#656e5e', ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <SvgCircle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.5} />
      <SvgCircle cx={12} cy={12} r={4} fill={color} />
    </Svg>
  );
}
