import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { IconProps } from './index';

/** Folded-map icon (used by the bottom-center Map FAB on the explore feed). */
export function Map({ size = 24, color = '#142800', ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 4v14M15 6v14"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
