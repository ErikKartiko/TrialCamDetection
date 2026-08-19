import React from 'react';

export type AppMode = 
  | 'idle' 
  | 'objectScan' 
  | 'currencyScan' 
  | 'location' 
  | 'navigation' 
  | 'voiceCommand'
  | 'info'
  | 'emergency';

interface ModeSelectorProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  isVisible: boolean;
  onClose: () => void;
}

const MODES = [
  { id: 'objectScan' as const, icon: '👁️', label: 'Deteksi Benda', shortcut: '1', description: 'Mendeteksi benda di sekitar' },
  { id: 'currencyScan' as const, icon: '💵', label: 'Cek Uang', shortcut: '2', description: 'Identifikasi uang rupiah' },
  { id: 'location' as const, icon: '📍', label: 'Lokasi Saya', shortcut: '3', description: 'Mengetahui posisi saat ini' },
  { id: 'navigation' as const, icon: '🧭', label: 'Navigasi', shortcut: '4', description: 'Petunjuk arah ke tujuan' },
  { id: 'info' as const, icon: '📊', label: 'Informasi', shortcut: '5', description: 'Waktu, cuaca, baterai' },
  { id: 'emergency' as const, icon: '🆘', label: 'Darurat', shortcut: '6', description: 'Panggilan darurat & lokasi' },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onSelectMode,
  isVisible,
  onClose,
}) => {
  if (!isVisible) return null;

  return (
    <div 
      className="absolute inset-0 z-40 bg-dark/98 flex flex-col"
      role="dialog"
      aria-label="Pilih mode fitur"
      onClick={onClose}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h2 className="text-xl font-bold text-white text-center">Pilih Fitur</h2>
        <p className="text-white/50 text-sm text-center mt-1">Ketuk untuk memilih atau ucapkan nomor</p>
      </div>

      {/* Mode Grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-3">
          {MODES.map((mode, index) => (
            <button
              key={mode.id}
              className={`w-full glass rounded-2xl p-4 flex items-center gap-4 transition-all active:scale-[0.98] ${
                currentMode === mode.id ? 'ring-2 ring-glow-blue bg-glow-blue/10' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectMode(mode.id);
              }}
              style={{ animationDelay: `${index * 0.1}s` }}
              aria-label={`${mode.shortcut}. ${mode.label}. ${mode.description}`}
            >
              <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">{mode.icon}</span>
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-glow-blue text-sm font-bold">{mode.shortcut}</span>
                  <span className="text-white font-semibold">{mode.label}</span>
                </div>
                <p className="text-white/50 text-sm mt-0.5">{mode.description}</p>
              </div>
              <div className="text-white/30 text-2xl">›</div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer hint */}
      <div className="p-4 border-t border-white/10">
        <p className="text-white/40 text-xs text-center">
          Geser ke bawah atau katakan "menu" untuk membuka
        </p>
      </div>
    </div>
  );
};
