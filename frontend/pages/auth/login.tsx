import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const schema = yup.object({
  email: yup.string().email('Email inválido').required('Email es requerido'),
  password: yup.string().min(6, 'Mínimo 6 caracteres').required('Contraseña es requerida'),
});

type LoginForm = yup.InferType<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        toast.success('Inicio de sesión exitoso');

        if (result.user.role === 'admin') {
          router.push('/admin/dashboard');
        } else if (result.user.role === 'evaluator') {
          router.push('/evaluator/dashboard');
        } else {
          router.push('/participant/dashboard');
        }
      } else {
        toast.error(result.error || 'Error al iniciar sesión');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* Left: Form panel */}
      <div className="w-full lg:w-2/5 bg-white flex flex-col px-10 lg:px-14 py-10">
        {/* Logo */}
        <Link href="/" className="mb-12">
          <Image src="/logo.png" alt="BRS Digital" width={210} height={60} className="h-[60px] w-auto" />
        </Link>

        {/* Form */}
        <div className="flex-1 flex flex-col justify-center max-w-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Iniciar sesión</h2>
          <p className="text-sm text-gray-500 mb-8">Accede a tu cuenta de BRS Digital</p>

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#0a2d4e' }}
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>

            <p className="text-center text-sm text-gray-500">
              ¿No tienes cuenta?{' '}
              <Link href="/auth/register" className="font-semibold hover:underline" style={{ color: '#0a2d4e' }}>
                Registrarse gratis
              </Link>
            </p>
          </form>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-xs text-gray-400">
          Basado en la Batería de Riesgo Psicosocial — Resolución 2646 de 2008
        </p>
      </div>

      {/* Right: Visual panel with floating cards */}
      <div className="hidden lg:flex lg:w-3/5 relative overflow-hidden" style={{ backgroundColor: '#e6f4fd' }}>

        {/* Card 1 – Reporte de Evaluación */}
        <div
          className="absolute top-16 left-12 w-64 bg-white rounded-2xl shadow-xl p-5 border border-gray-100"
          style={{ transform: 'rotate(-2deg)', zIndex: 20 }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reporte de Evaluación</span>
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">128</p>
              <p className="text-xs text-gray-500 mt-0.5">Respuestas</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">45</p>
              <p className="text-xs text-gray-500 mt-0.5">Dimensiones</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Intralaboral A', pct: 72, color: 'bg-blue-500' },
              { label: 'Extralaboral', pct: 45, color: 'bg-emerald-500' },
              { label: 'Estrés', pct: 88, color: 'bg-red-400' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span>{item.label}</span>
                  <span>{item.pct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className={`${item.color} h-1.5 rounded-full`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2 – Niveles de Riesgo */}
        <div
          className="absolute top-32 right-12 w-56 bg-white rounded-2xl shadow-xl p-5 border border-gray-100"
          style={{ transform: 'rotate(3deg)', zIndex: 10 }}
        >
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Niveles de Riesgo</p>
          <div className="space-y-2">
            {[
              { label: 'Sin riesgo', count: 18, color: 'bg-green-500' },
              { label: 'Riesgo bajo', count: 12, color: 'bg-yellow-400' },
              { label: 'Riesgo medio', count: 8, color: 'bg-orange-400' },
              { label: 'Riesgo alto', count: 5, color: 'bg-red-500' },
              { label: 'Muy alto', count: 2, color: 'bg-red-800' },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${r.color}`}></span>
                <span className="text-xs text-gray-600 flex-1">{r.label}</span>
                <span className="text-xs font-bold text-gray-800">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3 – Participante */}
        <div
          className="absolute bottom-28 left-16 w-60 bg-white rounded-2xl shadow-xl p-5 border border-gray-100"
          style={{ transform: 'rotate(1.5deg)', zIndex: 30 }}
        >
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Evaluación Individual</p>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              MR
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">María Rodríguez</p>
              <p className="text-xs text-gray-500">Jefe de área · Forma A</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-violet-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">Progreso del cuestionario</p>
            <div className="w-full bg-white rounded-full h-2 mb-1">
              <div className="bg-gradient-to-r from-blue-500 to-violet-500 h-2 rounded-full" style={{ width: '68%' }} />
            </div>
            <p className="text-xs font-semibold text-gray-700">68% completado</p>
          </div>
        </div>

        {/* Card 4 – Score badge */}
        <div
          className="absolute bottom-16 right-16 w-44 bg-gray-900 rounded-2xl shadow-xl p-4 text-white"
          style={{ transform: 'rotate(-1deg)', zIndex: 25 }}
        >
          <p className="text-xs text-gray-400 mb-1">Puntaje total</p>
          <p className="text-3xl font-bold mb-0.5">72.4</p>
          <p className="text-xs text-gray-400 mb-3">Percentil</p>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
            <span className="text-xs font-medium text-yellow-400">Riesgo Medio</span>
          </div>
        </div>

        {/* Decorative blur blob */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #a78bfa 0%, #60a5fa 100%)', zIndex: 1 }}
        />
      </div>

    </div>
  );
}
