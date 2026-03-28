import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import type { IconProps } from './index';

export function PlusCircle({ size = 24, color = '#656e5e', ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.5} />
      <Path
        d="M12 8v8M8 12h8"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
