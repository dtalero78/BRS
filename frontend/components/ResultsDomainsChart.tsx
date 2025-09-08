import React from 'react';

interface DomainResult {
  domain: string;
  averageScore: number;
  riskLevel: string;
  dimensionCount: number;
}

interface ResultsDomainsChartProps {
  domains: DomainResult[];
  title?: string;
}

const getRiskLevelColor = (score: number): string => {
  if (score <= 20) return '#10B981'; // green
  if (score <= 40) return '#3B82F6'; // blue
  if (score <= 60) return '#F59E0B'; // yellow
  if (score <= 80) return '#FB923C'; // orange
  return '#EF4444'; // red
};

const formatDomainName = (domain: string): string => {
  const domainNames: { [key: string]: string } = {
    'liderazgo_relaciones_sociales': 'Liderazgo y Relaciones',
    'control': 'Control',
    'demandas_trabajo': 'Demandas del Trabajo',
    'recompensas': 'Recompensas'
  };
  return domainNames[domain] || domain.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const ResultsDomainsChart: React.FC<ResultsDomainsChartProps> = ({ domains, title = "Resultados por Dominios" }) => {
  const maxScore = 100;
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      
      <div className="space-y-4">
        {domains.map((domain, index) => (
          <div key={index} className="relative">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm font-medium text-gray-700">
                {formatDomainName(domain.domain)}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  ({domain.dimensionCount} dimensiones)
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {domain.averageScore.toFixed(1)}%
                </span>
              </div>
            </div>
            
            <div className="relative">
              <div className="w-full bg-gray-100 rounded-full h-8">
                <div
                  className="h-8 rounded-full flex items-center justify-end pr-2 transition-all duration-300"
                  style={{
                    width: `${Math.min(domain.averageScore, maxScore)}%`,
                    backgroundColor: getRiskLevelColor(domain.averageScore)
                  }}
                >
                  <span className="text-xs font-semibold text-white">
                    {domain.averageScore.toFixed(0)}
                  </span>
                </div>
              </div>
              
              {/* Risk level indicators */}
              <div className="flex justify-between mt-1">
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-green-500 rounded-full" title="Sin riesgo (0-20)" />
                  <div className="w-1 h-1 bg-blue-500 rounded-full" title="Riesgo bajo (20-40)" />
                  <div className="w-1 h-1 bg-yellow-500 rounded-full" title="Riesgo medio (40-60)" />
                  <div className="w-1 h-1 bg-orange-500 rounded-full" title="Riesgo alto (60-80)" />
                  <div className="w-1 h-1 bg-red-500 rounded-full" title="Riesgo muy alto (80-100)" />
                </div>
                <span className="text-xs text-gray-400">
                  {domain.riskLevel.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span className="text-gray-600">Sin riesgo (0-20)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span className="text-gray-600">Bajo (20-40)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded" />
            <span className="text-gray-600">Medio (40-60)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-500 rounded" />
            <span className="text-gray-600">Alto (60-80)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded" />
            <span className="text-gray-600">Muy alto (80-100)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsDomainsChart;