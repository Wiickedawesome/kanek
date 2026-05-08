import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { IconProps } from './index';

/** Download / save-offline icon (mirrors AllTrails card download button). */
export function Download({ size = 24, color = '#142800', ...props }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M12 3v12m0 0 4-4m-4 4-4-4"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
