import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import type { IconProps } from './index';

export function ClipboardList({ size = 24, color = '#656e5e', ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Rect x={8} y={2} width={8} height={4} rx={1} stroke={color} strokeWidth={1.5} />
      <Path
        d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M12 11h4M12 16h4M8 11h.01M8 16h.01"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
