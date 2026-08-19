import { useCallback, useRef, useState } from 'react';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async (facing?: 'user' | 'environment') => {
    try {
      setError(null);
      
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const mode = facing || facingMode;
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
      setFacingMode(mode);
      return true;
    } catch (err: any) {
      console.error('Camera error:', err);
      setError('Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.');
      setIsActive(false);
      return false;
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const switchCamera = useCallback(async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    await startCamera(newMode);
  }, [facingMode, startCamera]);

  return {
    videoRef,
    isActive,
    facingMode,
    error,
    startCamera,
    stopCamera,
    switchCamera,
  };
}
