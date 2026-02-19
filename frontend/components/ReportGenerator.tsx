import React, { useState, useEffect } from 'react';
import { Download, FileText, Users, Clock, CheckCircle } from 'lucide-react';
import { API_URL } from '../config/api';

interface Evaluation {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Participant {
  participant_evaluation_id: string;
  email: string;
  status: string;
  completed_at: string;
}

interface ReportGeneratorProps {
  evaluations: Evaluation[];
  participants?: Participant[];
  selectedEvaluationId?: string;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ 
  evaluations, 
  participants = [], 
  selectedEvaluationId 
}) => {
  const [selectedEvaluation, setSelectedEvaluation] = useState<string>(selectedEvaluationId || '');
  const [selectedParticipant, setSelectedParticipant] = useState<string>('');
  const [reportType, setReportType] = useState<'individual' | 'organizational'>('individual');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeIndividualSummaries, setIncludeIndividualSummaries] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [completedParticipants, setCompletedParticipants] = useState<Participant[]>([]);

  // Filter completed participants for selected evaluation
  useEffect(() => {
    if (selectedEvaluation && participants.length > 0) {
      const completed = participants.filter(p => p.status === 'completed');
      setCompletedParticipants(completed);
      setSelectedParticipant(''); // Reset participant selection
    }
  }, [selectedEvaluation, participants]);

  const handleGenerateReport = async () => {
    if (!selectedEvaluation) {
      alert('Por favor selecciona una evaluación');
      return;
    }

    if (reportType === 'individual' && !selectedParticipant) {
      alert('Por favor selecciona un participante para el reporte individual');
      return;
    }

    setIsGenerating(true);

    try {
      const token = localStorage.getItem('token');
      let endpoint = '';
      let body = {};

      if (reportType === 'individual') {
        endpoint = `${API_URL}/api/reports/individual`;
        body = {
          participantEvaluationId: selectedParticipant,
          includeCharts,
          language: 'es'
        };
      } else {
        endpoint = `${API_URL}/api/reports/organizational`;
        body = {
          evaluationId: selectedEvaluation,
          includeCharts,
          includeIndividualSummaries
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        // El servidor devuelve el archivo PDF directamente
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        // Generate filename based on report type
        const evaluation = evaluations.find(e => e.id === selectedEvaluation);
        const participant = completedParticipants.find(p => p.participant_evaluation_id === selectedParticipant);
        
        let filename = '';
        if (reportType === 'individual' && participant) {
          filename = `Reporte_Individual_BRS_${participant.email}_${new Date().toISOString().split('T')[0]}.pdf`;
        } else if (reportType === 'organizational' && evaluation) {
          filename = `Reporte_Organizacional_BRS_${evaluation.name}_${new Date().toISOString().split('T')[0]}.pdf`;
        } else {
          filename = `Reporte_BRS_${new Date().toISOString().split('T')[0]}.pdf`;
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        alert('¡Reporte generado exitosamente!');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errorData.error || 'Error al generar el reporte');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert(`Error al generar el reporte: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="h-6 w-6 text-blue-600" />
        <h3 className="text-xl font-semibold text-gray-900">Generador de Reportes BRS</h3>
      </div>

      <div className="space-y-6">
        {/* Tipo de Reporte */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Reporte
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setReportType('individual')}
              className={`p-3 border rounded-lg text-left transition-colors ${
                reportType === 'individual'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="font-medium">Individual</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Reporte detallado de un participante específico
              </p>
            </button>
            
            <button
              onClick={() => setReportType('organizational')}
              className={`p-3 border rounded-lg text-left transition-colors ${
                reportType === 'organizational'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="font-medium">Organizacional</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Reporte consolidado de toda la evaluación
              </p>
            </button>
          </div>
        </div>

        {/* Selección de Evaluación */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Evaluación
          </label>
          <select
            value={selectedEvaluation}
            onChange={(e) => setSelectedEvaluation(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Selecciona una evaluación</option>
            {evaluations.map((evaluation) => (
              <option key={evaluation.id} value={evaluation.id}>
                {evaluation.name} - {evaluation.status}
              </option>
            ))}
          </select>
        </div>

        {/* Selección de Participante (solo para reportes individuales) */}
        {reportType === 'individual' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Participante
            </label>
            {completedParticipants.length > 0 ? (
              <select
                value={selectedParticipant}
                onChange={(e) => setSelectedParticipant(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!selectedEvaluation}
              >
                <option value="">Selecciona un participante</option>
                {completedParticipants.map((participant) => (
                  <option key={participant.participant_evaluation_id} value={participant.participant_evaluation_id}>
                    {participant.email} - {participant.completed_at ? new Date(participant.completed_at).toLocaleDateString('es-ES') : 'Sin fecha'}
                  </option>
                ))}
              </select>
            ) : selectedEvaluation ? (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    No hay participantes con evaluaciones completadas en esta evaluación
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                <span className="text-sm text-gray-600">
                  Selecciona una evaluación para ver los participantes disponibles
                </span>
              </div>
            )}
          </div>
        )}

        {/* Opciones de Configuración */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Opciones del Reporte
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeCharts}
                onChange={(e) => setIncludeCharts(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Incluir gráficos y visualizaciones</span>
            </label>
            
            {reportType === 'organizational' && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeIndividualSummaries}
                  onChange={(e) => setIncludeIndividualSummaries(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Incluir resúmenes individuales</span>
              </label>
            )}
          </div>
        </div>

        {/* Información del Reporte */}
        {selectedEvaluation && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium text-blue-900 mb-2">Información del Reporte:</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Evaluación: {evaluations.find(e => e.id === selectedEvaluation)?.name}</p>
              <p>• Tipo: {reportType === 'individual' ? 'Reporte Individual' : 'Reporte Organizacional'}</p>
              {reportType === 'individual' && selectedParticipant && (
                <p>• Participante: {completedParticipants.find(p => p.participant_evaluation_id === selectedParticipant)?.email}</p>
              )}
              {reportType === 'organizational' && (
                <p>• Participantes completados: {completedParticipants.length}</p>
              )}
              <p>• Formato: PDF profesional con metodología oficial BRS</p>
            </div>
          </div>
        )}

        {/* Botón de Generación */}
        <button
          onClick={handleGenerateReport}
          disabled={isGenerating || !selectedEvaluation || (reportType === 'individual' && !selectedParticipant)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Generando Reporte...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Generar Reporte PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ReportGenerator;