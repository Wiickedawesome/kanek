// Web camera capture modal using getUserMedia — forces a live camera capture
// rather than falling through to the browser file picker.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { showAlert } from '@/lib/alert';
import { colors, type, spacing, borderRadius } from '@/theme';

export type CameraFacing = 'front' | 'back';

export interface CameraCaptureProps {
  visible: boolean;
  facing: CameraFacing;
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

export function CameraCapture({ visible, facing, onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      showAlert('Camera unavailable', 'Your browser does not support camera access.');
      onCancel();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing === 'front' ? 'user' : { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch (err) {
      showAlert('Camera error', err instanceof Error ? err.message : 'Could not open camera');
      onCancel();
    }
  }, [facing, onCancel]);

  useEffect(() => {
    if (visible) {
      start();
    }
    return () => {
      stop();
    };
  }, [visible, start, stop]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stop();
    onCapture(dataUrl);
  };

  if (Platform.OS !== 'web') return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.frame}>
          {/* web-only <video> element in RN tree; React Native Web passes it through to the DOM */}
          <video ref={videoRef} style={webVideoStyle} playsInline muted autoPlay />
          {!ready && (
            <View style={styles.loadingOverlay}>
              <Text style={styles.loadingText}>Starting camera…</Text>
            </View>
          )}
        </View>

        <View style={styles.controls}>
          <Pressable style={[styles.btn, styles.btnCancel]} onPress={() => { stop(); onCancel(); }}>
            <Text style={styles.btnCancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnCapture, !ready && styles.btnDisabled]}
            onPress={handleCapture}
            disabled={!ready}
          >
            <Text style={styles.btnCaptureText}>Capture</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const webVideoStyle: any = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: borderRadius.md,
  backgroundColor: '#000',
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  frame: {
    width: '100%',
    maxWidth: 640,
    aspectRatio: 4 / 3,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0 as any,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...type.body.regular,
    color: '#fff',
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.pill,
    minWidth: 140,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#fff',
  },
  btnCancelText: {
    ...type.body.bold,
    color: '#fff',
  },
  btnCapture: {
    backgroundColor: colors.accent.green,
  },
  btnCaptureText: {
    ...type.body.bold,
    color: colors.forest[900],
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
