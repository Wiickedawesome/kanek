import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import type { IconProps } from './index';

export function QrCode({ size = 24, color = '#656e5e', ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Rect x={3} y={3} width={7} height={7} rx={1} stroke={color} strokeWidth={1.5} />
      <Rect x={14} y={3} width={7} height={7} rx={1} stroke={color} strokeWidth={1.5} />
      <Rect x={3} y={14} width={7} height={7} rx={1} stroke={color} strokeWidth={1.5} />
      <Path
        d="M14 14h3v3h-3zM20 14v3h-3M14 20h3M20 20h.01"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
