import React from 'react';

interface RiskSummaryData {
  sin_riesgo: number;
  riesgo_bajo: number;
  riesgo_medio: number;
  riesgo_alto: number;
  riesgo_muy_alto: number;
}

interface RiskSummaryChartProps {
  data: RiskSummaryData;
  title?: string;
  showPercentages?: boolean;
}

const RiskSummaryChart: React.FC<RiskSummaryChartProps> = ({ 
  data, 
  title = "Distribución de Riesgo",
  showPercentages = true 
}) => {
  const total = Object.values(data).reduce((sum, val) => sum + val, 0);
  
  const riskLevels = [
    { key: 'sin_riesgo', label: 'Sin Riesgo', color: 'bg-green-500', borderColor: 'border-green-600' },
    { key: 'riesgo_bajo', label: 'Riesgo Bajo', color: 'bg-blue-500', borderColor: 'border-blue-600' },
    { key: 'riesgo_medio', label: 'Riesgo Medio', color: 'bg-yellow-500', borderColor: 'border-yellow-600' },
    { key: 'riesgo_alto', label: 'Riesgo Alto', color: 'bg-orange-500', borderColor: 'border-orange-600' },
    { key: 'riesgo_muy_alto', label: 'Riesgo Muy Alto', color: 'bg-red-500', borderColor: 'border-red-600' }
  ];
  
  // Calculate percentages for the circular chart simulation
  let cumulativePercentage = 0;
  const segments = riskLevels.map(level => {
    const value = data[level.key as keyof RiskSummaryData];
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const segment = {
      ...level,
      value,
      percentage,
      startAngle: cumulativePercentage * 3.6, // Convert percentage to degrees
      endAngle: (cumulativePercentage + percentage) * 3.6
    };
    cumulativePercentage += percentage;
    return segment;
  });
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      
      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Circular representation using bars */}
        <div className="relative w-48 h-48">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {segments.map((segment, index) => {
              const radius = 40;
              const circumference = 2 * Math.PI * radius;
              const strokeDasharray = `${(segment.percentage / 100) * circumference} ${circumference}`;
              const rotation = segments.slice(0, index).reduce((sum, seg) => sum + seg.percentage, 0) * 3.6;
              
              return segment.value > 0 ? (
                <circle
                  key={segment.key}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="transparent"
                  stroke={segment.color.replace('bg-', '#').replace('500', '600')}
                  strokeWidth="20"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset="0"
                  style={{
                    transformOrigin: '50% 50%',
                    transform: `rotate(${rotation}deg)`
                  }}
                  className={segment.color.replace('bg-', 'stroke-')}
                />
              ) : null;
            })}
          </svg>
          
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-gray-900">{total}</span>
            <span className="text-xs text-gray-500">Total</span>
          </div>
        </div>
        
        {/* Legend and values */}
        <div className="flex-1">
          <div className="space-y-3">
            {riskLevels.map(level => {
              const value = data[level.key as keyof RiskSummaryData];
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              
              return (
                <div key={level.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded ${level.color}`} />
                    <span className="text-sm font-medium text-gray-700">{level.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{value}</span>
                    {showPercentages && (
                      <span className="text-xs text-gray-500">({percentage}%)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Summary Stats */}
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Riesgo promedio:</span>
              <p className="font-semibold text-gray-700">
                {segments.reduce((acc, seg) => {
                  const riskValue = riskLevels.findIndex(l => l.key === seg.key);
                  return acc + (seg.value * riskValue);
                }, 0) / (total || 1) < 1 ? 'Sin riesgo' :
                 segments.reduce((acc, seg) => {
                  const riskValue = riskLevels.findIndex(l => l.key === seg.key);
                  return acc + (seg.value * riskValue);
                }, 0) / (total || 1) < 2 ? 'Bajo' :
                 segments.reduce((acc, seg) => {
                  const riskValue = riskLevels.findIndex(l => l.key === seg.key);
                  return acc + (seg.value * riskValue);
                }, 0) / (total || 1) < 3 ? 'Medio' :
                 segments.reduce((acc, seg) => {
                  const riskValue = riskLevels.findIndex(l => l.key === seg.key);
                  return acc + (seg.value * riskValue);
                }, 0) / (total || 1) < 4 ? 'Alto' : 'Muy Alto'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Mayor concentración:</span>
              <p className="font-semibold text-gray-700">
                {riskLevels.find(l => l.key === Object.entries(data).reduce((max, [key, val]) => 
                  val > data[max as keyof RiskSummaryData] ? key : max, 'sin_riesgo'))?.label || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskSummaryChart;