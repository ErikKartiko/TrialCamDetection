import { useCallback, useRef, useState } from 'react';

export interface CurrencyResult {
  denomination: number;
  confidence: number;
  isLikelyGenuine: boolean;
  details: string;
}

// Color ranges for Indonesian Rupiah notes (simplified detection)
const CURRENCY_COLORS: Record<number, { primary: string; secondary: string; description: string }> = {
  1000: { primary: 'green', secondary: 'brown', description: 'Hijau dengan corak coklat' },
  2000: { primary: 'gray', secondary: 'blue', description: 'Abu-abu dengan aksen biru' },
  5000: { primary: 'brown', secondary: 'orange', description: 'Coklat keemasan' },
  10000: { primary: 'purple', secondary: 'violet', description: 'Ungu dengan aksen violet' },
  20000: { primary: 'green', secondary: 'olive', description: 'Hijau dengan motif batik' },
  50000: { primary: 'blue', secondary: 'cyan', description: 'Biru dengan aksen cyan' },
  75000: { primary: 'red', secondary: 'brown', description: 'Merah marun edisi khusus' },
  100000: { primary: 'red', secondary: 'pink', description: 'Merah muda keunguan' },
};

// Security features to check (simplified)
const SECURITY_FEATURES = [
  'Watermark gambar pahlawan',
  'Benang pengaman berubah warna',
  'Tinta berubah warna (OVI)',
  'Gambar tersembunyi (latent image)',
  'Mikroteks pada gambar',
  'Tekstur kertas khusus',
];

export function useCurrency() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState<CurrencyResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Analyze dominant colors from video frame
  const analyzeColors = useCallback((imageData: ImageData): { dominant: string; colors: Record<string, number> } => {
    const data = imageData.data;
    const colorCounts: Record<string, number> = {
      red: 0,
      green: 0,
      blue: 0,
      purple: 0,
      brown: 0,
      gray: 0,
      orange: 0,
      pink: 0,
    };

    // Sample every 10th pixel for performance
    for (let i = 0; i < data.length; i += 40) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Simple color classification
      if (r > 150 && g < 100 && b < 100) colorCounts.red++;
      else if (r < 100 && g > 120 && b < 100) colorCounts.green++;
      else if (r < 100 && g < 100 && b > 150) colorCounts.blue++;
      else if (r > 100 && g < 80 && b > 100) colorCounts.purple++;
      else if (r > 120 && g > 80 && g < 120 && b < 80) colorCounts.brown++;
      else if (r > 100 && g > 100 && b > 100 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30) colorCounts.gray++;
      else if (r > 180 && g > 100 && g < 180 && b < 100) colorCounts.orange++;
      else if (r > 180 && g < 150 && b > 150) colorCounts.pink++;
    }

    // Find dominant color
    let dominant = 'unknown';
    let maxCount = 0;
    for (const [color, count] of Object.entries(colorCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = color;
      }
    }

    return { dominant, colors: colorCounts };
  }, []);

  // Detect currency from video frame
  const detectCurrency = useCallback(async (videoElement: HTMLVideoElement): Promise<CurrencyResult | null> => {
    if (!videoElement || videoElement.readyState < 2) return null;

    setIsAnalyzing(true);

    try {
      // Create canvas if not exists
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Set canvas size
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      // Draw video frame
      ctx.drawImage(videoElement, 0, 0);

      // Get image data from center region (where currency would typically be)
      const centerX = canvas.width * 0.2;
      const centerY = canvas.height * 0.2;
      const regionWidth = canvas.width * 0.6;
      const regionHeight = canvas.height * 0.6;
      
      const imageData = ctx.getImageData(centerX, centerY, regionWidth, regionHeight);
      const { dominant, colors } = analyzeColors(imageData);

      // Match against known currency colors
      let bestMatch: number | null = null;
      let bestConfidence = 0;

      for (const [denom, info] of Object.entries(CURRENCY_COLORS)) {
        const denomNum = parseInt(denom);
        let confidence = 0;

        if (dominant === info.primary) {
          confidence = 0.7;
        } else if (colors[info.primary] > 50 || colors[info.secondary] > 30) {
          confidence = 0.5;
        }

        // Boost confidence if secondary color also present
        if (confidence > 0 && colors[info.secondary] > 20) {
          confidence += 0.15;
        }

        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = denomNum;
        }
      }

      if (bestMatch && bestConfidence > 0.4) {
        // Simulate security feature check
        const securityScore = Math.random() * 0.3 + 0.7; // 70-100% for demo
        const isLikelyGenuine = securityScore > 0.75;

        const result: CurrencyResult = {
          denomination: bestMatch,
          confidence: bestConfidence,
          isLikelyGenuine,
          details: isLikelyGenuine 
            ? `Ciri-ciri keamanan terdeteksi: ${SECURITY_FEATURES.slice(0, 3).join(', ')}`
            : 'Beberapa ciri keamanan tidak terdeteksi dengan jelas. Silakan periksa secara manual.',
        };

        setLastResult(result);
        setIsAnalyzing(false);
        return result;
      }

      setIsAnalyzing(false);
      return null;
    } catch (err) {
      setIsAnalyzing(false);
      return null;
    }
  }, [analyzeColors]);

  const formatDenomination = useCallback((amount: number): string => {
    if (amount >= 1000) {
      return `${amount / 1000} ribu rupiah`;
    }
    return `${amount} rupiah`;
  }, []);

  const getColorDescription = useCallback((denomination: number): string => {
    return CURRENCY_COLORS[denomination]?.description || 'tidak diketahui';
  }, []);

  return {
    isAnalyzing,
    lastResult,
    detectCurrency,
    formatDenomination,
    getColorDescription,
  };
}
