import React from 'react';

interface LoadingScreenProps {
  progress: string;
  subText?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress, subText }) => {
  return (
    <div className="fixed inset-0 bg-dark flex flex-col items-center justify-center z-50"
      role="alert"
      aria-live="assertive"
      aria-label={`Memuat: ${progress}`}
    >
      {/* Logo / Icon */}
      <div className="relative mb-8">
        <div className="w-28 h-28 rounded-full border-4 border-glow-blue/30 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full border-4 border-glow-blue/60 flex items-center justify-center animate-breathe">
            <span className="text-4xl">👁️</span>
          </div>
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-glow-blue animate-spin" />
      </div>

      {/* App Name */}
      <h1 className="text-3xl font-bold text-white mb-2 tracking-wider">
        VisioBantu
      </h1>
      <p className="text-glow-blue/80 text-sm mb-8 tracking-widest uppercase">
        Asisten Penglihatan AI
      </p>

      {/* Progress */}
      <div className="w-64 mb-4">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-glow-blue to-glow-green rounded-full transition-all duration-1000 animate-pulse"
            style={{ width: '60%' }}
          />
        </div>
      </div>

      <p className="text-white/70 text-sm text-center px-8">{progress}</p>
      {subText && (
        <p className="text-white/40 text-xs mt-2 text-center px-8">{subText}</p>
      )}
    </div>
  );
};
