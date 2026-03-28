import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { IconProps } from './index';

export function MapPin({ size = 24, color = '#656e5e', ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke={color}
        strokeWidth={1.5}
      />
    </Svg>
  );
}
