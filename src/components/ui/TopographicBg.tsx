import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

const LINE_COLOR = '#2b381f'; // forest[700]
const LINE_OPACITY = 0.06;

export function TopographicBg() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 400 900"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Large sweeping contour lines */}
      <Path
        d="M-50 120 Q100 80 200 140 T450 100"
        stroke={LINE_COLOR}
        strokeWidth={1.2}
        fill="none"
        opacity={LINE_OPACITY}
      />
      <Path
        d="M-30 180 Q120 140 220 200 T470 160"
        stroke={LINE_COLOR}
        strokeWidth={1}
        fill="none"
        opacity={LINE_OPACITY * 0.8}
      />
      <Path
        d="M-60 300 Q80 250 180 310 T440 280"
        stroke={LINE_COLOR}
        strokeWidth={1.4}
        fill="none"
        opacity={LINE_OPACITY}
      />
      <Path
        d="M-20 360 Q100 320 200 370 T460 340"
        stroke={LINE_COLOR}
        strokeWidth={1}
        fill="none"
        opacity={LINE_OPACITY * 0.7}
      />

      {/* Medium organic loops */}
      <Path
        d="M280 200 Q320 160 360 200 T340 260 Q300 280 280 240 Z"
        stroke={LINE_COLOR}
        strokeWidth={1}
        fill="none"
        opacity={LINE_OPACITY * 0.9}
      />
      <Path
        d="M60 450 Q100 410 140 450 T120 510 Q80 530 60 490 Z"
        stroke={LINE_COLOR}
        strokeWidth={1.2}
        fill="none"
        opacity={LINE_OPACITY}
      />

      {/* Small elevation contours */}
      <Circle cx={320} cy={500} r={30} stroke={LINE_COLOR} strokeWidth={0.8} fill="none" opacity={LINE_OPACITY * 0.6} />
      <Circle cx={320} cy={500} r={20} stroke={LINE_COLOR} strokeWidth={0.8} fill="none" opacity={LINE_OPACITY * 0.5} />
      <Circle cx={320} cy={500} r={10} stroke={LINE_COLOR} strokeWidth={0.8} fill="none" opacity={LINE_OPACITY * 0.4} />

      {/* Lower section contours */}
      <Path
        d="M-40 520 Q90 480 200 540 T450 500"
        stroke={LINE_COLOR}
        strokeWidth={1.2}
        fill="none"
        opacity={LINE_OPACITY}
      />
      <Path
        d="M-50 600 Q100 560 200 620 T460 580"
        stroke={LINE_COLOR}
        strokeWidth={1}
        fill="none"
        opacity={LINE_OPACITY * 0.8}
      />
      <Path
        d="M-30 700 Q110 660 220 720 T450 690"
        stroke={LINE_COLOR}
        strokeWidth={1.4}
        fill="none"
        opacity={LINE_OPACITY}
      />
      <Path
        d="M-60 780 Q80 740 180 800 T440 760"
        stroke={LINE_COLOR}
        strokeWidth={1}
        fill="none"
        opacity={LINE_OPACITY * 0.7}
      />

      {/* Small loop cluster */}
      <Path
        d="M80 700 Q110 680 130 710 T110 740 Q85 750 80 720 Z"
        stroke={LINE_COLOR}
        strokeWidth={0.8}
        fill="none"
        opacity={LINE_OPACITY * 0.8}
      />

      {/* Scattered elevation circles */}
      <Circle cx={150} cy={250} r={35} stroke={LINE_COLOR} strokeWidth={1} fill="none" opacity={LINE_OPACITY * 0.5} />
      <Circle cx={150} cy={250} r={22} stroke={LINE_COLOR} strokeWidth={0.8} fill="none" opacity={LINE_OPACITY * 0.4} />

      <Circle cx={350} cy={750} r={25} stroke={LINE_COLOR} strokeWidth={1} fill="none" opacity={LINE_OPACITY * 0.6} />
      <Circle cx={350} cy={750} r={15} stroke={LINE_COLOR} strokeWidth={0.8} fill="none" opacity={LINE_OPACITY * 0.5} />
    </Svg>
  );
}
