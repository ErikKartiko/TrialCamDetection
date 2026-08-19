import React from 'react';
import { RouteData } from '../hooks/useLocation';

interface NavigationPanelProps {
  route: RouteData | null;
  currentStepIndex: number;
  isActive: boolean;
  formatDistance: (meters: number) => string;
  formatDuration: (seconds: number) => string;
}

export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  route,
  currentStepIndex,
  isActive,
  formatDistance,
  formatDuration,
}) => {
  if (!route || !isActive) return null;

  const currentStep = route.steps[currentStepIndex];
  const nextStep = route.steps[currentStepIndex + 1];

  return (
    <div className="absolute inset-0 flex flex-col pointer-events-none">
      {/* Top: Route summary */}
      <div className="p-4">
        <div className="glass rounded-2xl p-4 pointer-events-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-glow-blue text-sm font-medium">🧭 Navigasi Aktif</span>
            <span className="text-white/50 text-xs">
              Langkah {currentStepIndex + 1} / {route.steps.length}
            </span>
          </div>
          <p className="text-white/60 text-xs truncate">
            Menuju: {route.destinationName.split(',')[0]}
          </p>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-white">📏 {formatDistance(route.totalDistance)}</span>
            <span className="text-white">⏱️ {formatDuration(route.totalDuration)}</span>
          </div>
        </div>
      </div>

      {/* Center spacer */}
      <div className="flex-1" />

      {/* Bottom: Current instruction */}
      <div className="p-4">
        <div className="glass rounded-2xl overflow-hidden pointer-events-auto">
          {/* Current step - large */}
          <div className="p-5 bg-glow-blue/10 border-b border-white/10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-glow-blue/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">
                  {currentStep?.instruction.includes('kiri') ? '⬅️' :
                   currentStep?.instruction.includes('kanan') ? '➡️' :
                   currentStep?.instruction.includes('sampai') ? '🏁' : '⬆️'}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium leading-relaxed">
                  {currentStep?.instruction || 'Memuat...'}
                </p>
                {currentStep && (
                  <p className="text-glow-blue text-sm mt-1">
                    {formatDistance(currentStep.distance)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Next step preview */}
          {nextStep && (
            <div className="p-3 flex items-center gap-3">
              <span className="text-white/40 text-sm">Lalu:</span>
              <p className="text-white/60 text-sm flex-1 truncate">
                {nextStep.instruction}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
