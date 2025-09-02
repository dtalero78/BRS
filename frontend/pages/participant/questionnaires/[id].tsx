import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import QuestionnaireForm from '../../../components/QuestionnaireForm';
import toast from 'react-hot-toast';

interface Assignment {
  id: number;
  questionnaire_type: string;
  status: string;
  evaluation: {
    name: string;
    description: string;
  };
}

export default function QuestionnaireDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchAssignment();
    }
  }, [id]);

  const fetchAssignment = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/participant/questionnaires/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAssignment(data.assignment);
      } else if (response.status === 404) {
        toast.error('Cuestionario no encontrado');
        router.push('/participant/questionnaires');
      } else {
        toast.error('Error al cargar el cuestionario');
        router.push('/participant/questionnaires');
      }
    } catch (error) {
      toast.error('Error de conexión');
      router.push('/participant/questionnaires');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Cargando...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!assignment) {
    return (
      <Layout title="Error">
        <div className="text-center py-12">
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Cuestionario no encontrado
          </h3>
        </div>
      </Layout>
    );
  }

  if (assignment.status === 'completed') {
    return (
      <Layout title="Cuestionario Completado">
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Cuestionario Completado
          </h3>
          <p className="text-gray-600 mb-6">
            Ya has completado este cuestionario. Los resultados serán procesados por tu evaluador.
          </p>
          <button
            onClick={() => router.push('/participant/questionnaires')}
            className="btn-primary"
          >
            Volver a Cuestionarios
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Cuestionario: ${assignment.evaluation.name}`}>
      <div className="mb-6">
        <button
          onClick={() => router.push('/participant/questionnaires')}
          className="text-blue-600 hover:text-blue-500 flex items-center text-sm"
        >
          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver a Cuestionarios
        </button>
      </div>

      <QuestionnaireForm
        participantEvaluationId={assignment.id}
        questionnaireType={assignment.questionnaire_type}
      />
    </Layout>
  );
}