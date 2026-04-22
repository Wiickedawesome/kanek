// Native stub — native path uses expo-image-picker's launchCameraAsync directly
// from the calling screen, so this component is a no-op render on native.

export type CameraFacing = 'front' | 'back';

export interface CameraCaptureProps {
  visible: boolean;
  facing: CameraFacing;
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

export function CameraCapture(_props: CameraCaptureProps) {
  return null;
}
