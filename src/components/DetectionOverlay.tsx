import React from 'react';
import { DetectedObject, translateObject } from '../hooks/useObjectDetection';

interface DetectionOverlayProps {
  detections: DetectedObject[];
  videoWidth: number;
  videoHeight: number;
  containerWidth: number;
  containerHeight: number;
}

export const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  detections,
  videoWidth,
  videoHeight,
  containerWidth,
  containerHeight,
}) => {
  if (!videoWidth || !videoHeight) return null;

  const scaleX = containerWidth / videoWidth;
  const scaleY = containerHeight / videoHeight;

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {detections.map((det, index) => {
        const [x, y, width, height] = det.bbox;
        const scaledX = x * scaleX;
        const scaledY = y * scaleY;
        const scaledW = width * scaleX;
        const scaledH = height * scaleY;
        const confidence = Math.round(det.score * 100);

        return (
          <div key={`${det.class}-${index}`}>
            {/* Bounding box */}
            <div
              className="detection-box"
              style={{
                left: `${scaledX}px`,
                top: `${scaledY}px`,
                width: `${scaledW}px`,
                height: `${scaledH}px`,
              }}
            >
              {/* Label */}
              <div className="detection-label">
                {translateObject(det.class)} {confidence}%
              </div>

              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-glow-green rounded-tl" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-glow-green rounded-tr" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-glow-green rounded-bl" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-glow-green rounded-br" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
