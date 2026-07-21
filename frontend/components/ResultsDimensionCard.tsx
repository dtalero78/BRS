import React from 'react';
import { dimensionName } from '../config/dimensionNames';

interface DimensionResult {
  dimension: string;
  rawScore: number | null;
  transformedScore: number | null;
  percentile: number | null;
  riskLevel: string;
}

interface ResultsDimensionCardProps {
  dimension: DimensionResult;
  showDetails?: boolean;
}

const getRiskLevelColor = (riskLevel: string) => {
  switch (riskLevel) {
    case 'sin_riesgo': return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', bar: 'bg-green-500' };
    case 'riesgo_bajo': return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', bar: 'bg-blue-500' };
    case 'riesgo_medio': return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', bar: 'bg-yellow-500' };
    case 'riesgo_alto': return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', bar: 'bg-orange-500' };
    case 'riesgo_muy_alto': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', bar: 'bg-red-500' };
    case 'no_calculable': return { bg: 'bg-gray-100', border: 'border-gray-200', text: 'text-gray-800', bar: 'bg-gray-400' };
    default: return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', bar: 'bg-gray-400' };
  }
};

const getRiskLevelLabel = (riskLevel: string) => {
  const labels: { [key: string]: string } = {
    'sin_riesgo': 'Sin Riesgo',
    'riesgo_bajo': 'Riesgo Bajo',
    'riesgo_medio': 'Riesgo Medio',
    'riesgo_alto': 'Riesgo Alto',
    'riesgo_muy_alto': 'Riesgo Muy Alto',
    'no_calculable': 'No calculable'
  };
  return labels[riskLevel] || riskLevel;
};

// Nombres canónicos (alineados con el PDF), fuente única en config/dimensionNames.
const formatDimensionName = (dimension: string) => dimensionName(dimension);

const ResultsDimensionCard: React.FC<ResultsDimensionCardProps> = ({ dimension, showDetails = false }) => {
  const colors = getRiskLevelColor(dimension.riskLevel);
  
  return (
    <div className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-4 transition-all hover:shadow-md`}>
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          {formatDimensionName(dimension.dimension)}
        </h3>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.text} ${colors.bg} border ${colors.border}`}>
          {getRiskLevelLabel(dimension.riskLevel)}
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Puntaje</span>
          <span className="font-semibold text-gray-700">
            {dimension.transformedScore != null ? `${dimension.transformedScore.toFixed(1)}%` : 'N/C'}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${colors.bar}`}
            style={{ width: dimension.transformedScore != null ? `${Math.min(dimension.transformedScore, 100)}%` : '0%' }}
          />
        </div>
      </div>

      {showDetails && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Bruto:</span>
            <p className="font-semibold text-gray-700">{dimension.rawScore != null ? dimension.rawScore : 'N/C'}</p>
          </div>
          <div>
            <span className="text-gray-500">Transform:</span>
            <p className="font-semibold text-gray-700">{dimension.transformedScore != null ? dimension.transformedScore.toFixed(1) : 'N/C'}</p>
          </div>
          <div>
            <span className="text-gray-500">Percentil:</span>
            <p className="font-semibold text-gray-700">{dimension.percentile != null ? `P${dimension.percentile}` : 'N/C'}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsDimensionCard;