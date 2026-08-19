import React from 'react';
import { CurrencyResult as CurrencyResultType } from '../hooks/useCurrency';

interface CurrencyResultProps {
  result: CurrencyResultType | null;
  isAnalyzing: boolean;
}

export const CurrencyResultDisplay: React.FC<CurrencyResultProps> = ({
  result,
  isAnalyzing,
}) => {
  if (isAnalyzing) {
    return (
      <div className="absolute bottom-24 left-4 right-4 z-10">
        <div className="glass rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-glow-blue/20 flex items-center justify-center animate-pulse">
            <span className="text-xl">💵</span>
          </div>
          <div>
            <p className="text-white font-medium">Menganalisis uang...</p>
            <p className="text-white/50 text-sm">Arahkan kamera ke uang kertas</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="absolute bottom-24 left-4 right-4 z-10">
      <div className={`glass rounded-2xl overflow-hidden ${
        result.isLikelyGenuine ? 'ring-2 ring-glow-green' : 'ring-2 ring-warning'
      }`}>
        {/* Header */}
        <div className={`p-4 ${
          result.isLikelyGenuine ? 'bg-glow-green/10' : 'bg-warning/10'
        }`}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
              <span className="text-3xl">💵</span>
            </div>
            <div className="flex-1">
              <p className="text-white text-2xl font-bold">
                {formatCurrency(result.denomination)}
              </p>
              <p className="text-white/70 text-sm">
                Kepercayaan: {Math.round(result.confidence * 100)}%
              </p>
            </div>
            <div className="text-4xl">
              {result.isLikelyGenuine ? '✅' : '⚠️'}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${
              result.isLikelyGenuine ? 'bg-glow-green' : 'bg-warning'
            }`} />
            <span className={`font-medium ${
              result.isLikelyGenuine ? 'text-glow-green' : 'text-warning'
            }`}>
              {result.isLikelyGenuine ? 'Kemungkinan Asli' : 'Perlu Verifikasi'}
            </span>
          </div>
          <p className="text-white/60 text-sm leading-relaxed">
            {result.details}
          </p>
        </div>
      </div>
    </div>
  );
};
