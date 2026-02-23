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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        toast.success('Inicio de sesión exitoso');
        
        // Redirect based on user role
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
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4" style={{ backgroundColor: '#e6f4fd' }}>

      {/* Logo arriba de la tarjeta */}
      <Link href="/" className="mb-8">
        <Image src="/logo.png" alt="BRS Digital" width={300} height={86} className="h-[86px] w-auto" />
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-blue-100 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Iniciar sesión</h2>
        <p className="text-sm text-gray-500 mb-8">Accede a tu cuenta de BRS Digital</p>

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': '#0a2d4e' } as React.CSSProperties}
              placeholder="usuario@empresa.com"
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2"
                placeholder="••••••••"
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

      <p className="mt-8 text-xs text-gray-400 text-center max-w-xs">
        Basado en la Batería de Riesgo Psicosocial — Resolución 2646 de 2008
      </p>
    </div>
  );
}