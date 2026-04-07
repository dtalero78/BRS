import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import Head from 'next/head';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const schema = yup.object({
  firstName: yup.string().required('Nombre es requerido'),
  lastName: yup.string().required('Apellido es requerido'),
  email: yup.string().email('Email inválido').required('Email es requerido'),
  password: yup.string().min(6, 'Mínimo 6 caracteres').required('Contraseña es requerida'),
  confirmPassword: yup.string()
    .oneOf([yup.ref('password')], 'Las contraseñas no coinciden')
    .required('Confirma tu contraseña'),
});

type RegisterForm = yup.InferType<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Google Analytics conversion event
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'sign_up', {
            method: 'email',
          });
        }
        toast.success('Cuenta creada exitosamente');
        router.push('/auth/login');
      } else {
        toast.error(result.error || 'Error al crear la cuenta');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2";

  return (
    <>
    <Head>
      <meta name="robots" content="noindex, nofollow" />
    </Head>
    <div className="min-h-screen flex">

      {/* Left: Form panel */}
      <div className="w-full lg:w-2/5 bg-white flex flex-col px-10 lg:px-14 py-10">
        {/* Logo */}
        <Link href="/" className="mb-10">
          <Image src="/logo.png" alt="BRS Digital" width={210} height={60} className="h-[60px] w-auto" />
        </Link>

        {/* Form */}
        <div className="flex-1 flex flex-col justify-center max-w-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Crear cuenta</h2>
          <p className="text-sm text-gray-500 mb-8">Regístrate como psicólogo evaluador</p>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input {...register('firstName')} type="text" className={inputClass} />
                {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                <input {...register('lastName')} type="text" className={inputClass} />
                {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input {...register('email')} type="email" autoComplete="email" className={inputClass} />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <input {...register('password')} type={showPassword ? 'text' : 'password'} className={`${inputClass} pr-10`} />
                <button type="button" className="absolute inset-y-0 right-0 flex items-center pr-3" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeSlashIcon className="h-4 w-4 text-gray-400" /> : <EyeIcon className="h-4 w-4 text-gray-400" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Contraseña</label>
              <input {...register('confirmPassword')} type={showPassword ? 'text' : 'password'} className={inputClass} />
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{ backgroundColor: '#0a2d4e' }}
            >
              {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>

            <p className="text-center text-sm text-gray-500">
              ¿Ya tienes cuenta?{' '}
              <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: '#0a2d4e' }}>
                Iniciar sesión
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

        {/* Center: Psychologist photo */}
        <div className="absolute inset-0 flex items-end justify-center pointer-events-none" style={{ zIndex: 5 }}>
          <Image src="/psicologa.jpg" alt="Psicóloga BRS" width={420} height={540} className="object-contain h-[85%] w-auto" />
        </div>

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
    </>
  );
}
