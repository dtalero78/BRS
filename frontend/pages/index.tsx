import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ChartBarIcon, UserGroupIcon, DocumentTextIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token and get user info
      // This would normally be done with a proper auth hook
    }
  }, []);

  const handleLogin = () => {
    router.push('/auth/login');
  };

  const features = [
    {
      icon: DocumentTextIcon,
      title: 'Cuestionarios Digitales',
      description: 'Aplicación de los 4 cuestionarios oficiales BRS de forma digital y segura.',
    },
    {
      icon: ChartBarIcon,
      title: 'Cálculos Automáticos',
      description: 'Motor de cálculo con baremos oficiales del Ministerio de la Protección Social.',
    },
    {
      icon: UserGroupIcon,
      title: 'Gestión de Participantes',
      description: 'Administración completa de empresas, evaluaciones y participantes.',
    },
    {
      icon: Cog6ToothIcon,
      title: 'Reportes Profesionales',
      description: 'Generación automática de reportes individuales y organizacionales.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full mb-4">
              <ChartBarIcon className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              BRS Digital
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Batería de Riesgo Psicosocial - Plataforma oficial para la evaluación 
              de factores de riesgo psicosocial en entornos laborales
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <button
              onClick={handleLogin}
              className="btn-primary text-lg px-8 py-3"
            >
              Iniciar Sesión
            </button>
            <Link href="/auth/register" className="btn-secondary text-lg px-8 py-3">
              Registrar Empresa
            </Link>
          </div>

          <div className="text-sm text-gray-500">
            Basado en la Resolución 2646 de 2008 - Ministerio de la Protección Social
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {features.map((feature, index) => (
            <div key={index} className="card text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                <feature.icon className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-16">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            Cobertura Completa de la BRS Oficial
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">282</div>
              <div className="text-sm text-gray-600">Preguntas Estructuradas</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600 mb-2">45</div>
              <div className="text-sm text-gray-600">Dimensiones Implementadas</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600 mb-2">10</div>
              <div className="text-sm text-gray-600">Dominios Evaluados</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600 mb-2">5</div>
              <div className="text-sm text-gray-600">Niveles de Riesgo</div>
            </div>
          </div>
        </div>

        {/* Questionnaire Types */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Cuestionarios Disponibles
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <div className="text-lg font-semibold text-blue-600 mb-2">Forma A</div>
              <div className="text-sm text-gray-600 mb-2">123 preguntas</div>
              <div className="text-xs text-gray-500">Jefes, profesionales, técnicos</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <div className="text-lg font-semibold text-green-600 mb-2">Forma B</div>
              <div className="text-sm text-gray-600 mb-2">97 preguntas</div>
              <div className="text-xs text-gray-500">Auxiliares, operarios</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <div className="text-lg font-semibold text-purple-600 mb-2">Extralaboral</div>
              <div className="text-sm text-gray-600 mb-2">31 preguntas</div>
              <div className="text-xs text-gray-500">Factores externos</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <div className="text-lg font-semibold text-orange-600 mb-2">Estrés</div>
              <div className="text-sm text-gray-600 mb-2">31 síntomas</div>
              <div className="text-xs text-gray-500">Evaluación específica</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}