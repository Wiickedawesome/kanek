import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { IconProps } from './index';

export function Navigation({ size = 24, color = '#656e5e', ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="m3 11 19-9-9 19-2-8-8-2Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
