interface DriverPinProps {
  coordinate: [number, number];
  heading: number | null;
}

/** Web stub — native Mapbox GL driver pin is not available on web */
export function DriverPin(_props: DriverPinProps) {
  return null;
}
