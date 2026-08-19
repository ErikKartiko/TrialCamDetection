import { useCallback, useRef, useState } from 'react';

export interface DetectedObject {
  class: string;
  score: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
}

// Indonesian translations for COCO-SSD classes
const TRANSLATIONS: Record<string, string> = {
  'person': 'orang',
  'bicycle': 'sepeda',
  'car': 'mobil',
  'motorcycle': 'motor',
  'airplane': 'pesawat',
  'bus': 'bus',
  'train': 'kereta',
  'truck': 'truk',
  'boat': 'perahu',
  'traffic light': 'lampu lalu lintas',
  'fire hydrant': 'hidran air',
  'stop sign': 'tanda berhenti',
  'parking meter': 'meteran parkir',
  'bench': 'bangku',
  'bird': 'burung',
  'cat': 'kucing',
  'dog': 'anjing',
  'horse': 'kuda',
  'sheep': 'domba',
  'cow': 'sapi',
  'elephant': 'gajah',
  'bear': 'beruang',
  'zebra': 'zebra',
  'giraffe': 'jerapah',
  'backpack': 'tas ransel',
  'umbrella': 'payung',
  'handbag': 'tas tangan',
  'tie': 'dasi',
  'suitcase': 'koper',
  'frisbee': 'frisbee',
  'skis': 'ski',
  'snowboard': 'papan salju',
  'sports ball': 'bola',
  'kite': 'layang-layang',
  'baseball bat': 'pemukul bisbol',
  'baseball glove': 'sarung tangan bisbol',
  'skateboard': 'papan seluncur',
  'surfboard': 'papan selancar',
  'tennis racket': 'raket tenis',
  'bottle': 'botol',
  'wine glass': 'gelas anggur',
  'cup': 'cangkir',
  'fork': 'garpu',
  'knife': 'pisau',
  'spoon': 'sendok',
  'bowl': 'mangkok',
  'banana': 'pisang',
  'apple': 'apel',
  'sandwich': 'sandwich',
  'orange': 'jeruk',
  'broccoli': 'brokoli',
  'carrot': 'wortel',
  'hot dog': 'hot dog',
  'pizza': 'pizza',
  'donut': 'donat',
  'cake': 'kue',
  'chair': 'kursi',
  'couch': 'sofa',
  'potted plant': 'tanaman pot',
  'bed': 'tempat tidur',
  'dining table': 'meja makan',
  'toilet': 'toilet',
  'tv': 'televisi',
  'laptop': 'laptop',
  'mouse': 'mouse komputer',
  'remote': 'remote',
  'keyboard': 'keyboard',
  'cell phone': 'ponsel',
  'microwave': 'microwave',
  'oven': 'oven',
  'toaster': 'pemanggang roti',
  'sink': 'wastafel',
  'refrigerator': 'kulkas',
  'book': 'buku',
  'clock': 'jam',
  'vase': 'vas',
  'scissors': 'gunting',
  'teddy bear': 'boneka beruang',
  'hair drier': 'pengering rambut',
  'toothbrush': 'sikat gigi',
};

export function translateObject(name: string): string {
  return TRANSLATIONS[name.toLowerCase()] || name;
}

export function useObjectDetection() {
  const [model, setModel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [detections, setDetections] = useState<DetectedObject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDetectingRef = useRef(false);

  const loadModel = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Dynamic import to avoid bundling issues
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      await import('@tensorflow/tfjs');
      
      const loadedModel = await cocoSsd.load({
        base: 'lite_mobilenet_v2',
      });
      
      setModel(loadedModel);
      setIsModelReady(true);
      setIsLoading(false);
      return loadedModel;
    } catch (err) {
      console.error('Error loading model:', err);
      setError('Gagal memuat model AI. Silakan muat ulang halaman.');
      setIsLoading(false);
      return null;
    }
  }, []);

  const detectObjects = useCallback(async (
    videoElement: HTMLVideoElement,
    minScore: number = 0.5
  ) => {
    if (!model || isDetectingRef.current) return [];
    
    isDetectingRef.current = true;
    try {
      const predictions = await model.detect(videoElement, 20, minScore);
      const results: DetectedObject[] = predictions.map((p: any) => ({
        class: p.class,
        score: p.score,
        bbox: p.bbox as [number, number, number, number],
      }));
      setDetections(results);
      isDetectingRef.current = false;
      return results;
    } catch (err) {
      isDetectingRef.current = false;
      return [];
    }
  }, [model]);

  const startContinuousDetection = useCallback((
    videoElement: HTMLVideoElement,
    onDetection: (objects: DetectedObject[]) => void,
    interval: number = 500,
    minScore: number = 0.45
  ) => {
    if (!model) return;

    let lastTime = 0;

    const detect = async (time: number) => {
      if (time - lastTime >= interval) {
        lastTime = time;
        if (videoElement.readyState >= 2 && !isDetectingRef.current) {
          const results = await detectObjects(videoElement, minScore);
          onDetection(results);
        }
      }
      animFrameRef.current = requestAnimationFrame(detect);
    };

    animFrameRef.current = requestAnimationFrame(detect);
  }, [model, detectObjects]);

  const stopDetection = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setDetections([]);
  }, []);

  return {
    model,
    isLoading,
    isModelReady,
    detections,
    error,
    loadModel,
    detectObjects,
    startContinuousDetection,
    stopDetection,
    translateObject,
  };
}
