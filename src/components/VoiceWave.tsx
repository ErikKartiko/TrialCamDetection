import React from 'react';

interface VoiceWaveProps {
  active: boolean;
  color?: string;
}

export const VoiceWave: React.FC<VoiceWaveProps> = ({ active, color = '#00d4ff' }) => {
  if (!active) return null;

  return (
    <div className="flex items-center gap-1 h-8" aria-hidden="true">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="voice-bar"
          style={{
            background: color,
            animationPlayState: active ? 'running' : 'paused',
          }}
        />
      ))}
    </div>
  );
};
