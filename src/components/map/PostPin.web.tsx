import type { PostType } from '@/types/database';

interface PostPinProps {
  id: string;
  coordinate: [number, number];
  type: PostType;
  title: string;
  onPress?: (id: string) => void;
}

/** Web stub — native Mapbox GL post pin is not available on web */
export function PostPin(_props: PostPinProps) {
  return null;
}
