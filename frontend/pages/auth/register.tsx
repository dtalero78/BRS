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

  const inputClass = "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4" style={{ backgroundColor: '#e6f4fd' }}>

      {/* Logo arriba de la tarjeta */}
      <Link href="/" className="mb-8">
        <Image src="/logo.png" alt="BRS Digital" width={300} height={86} className="h-[86px] w-auto" />
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-blue-100 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Crear cuenta</h2>
        <p className="text-sm text-gray-500 mb-8">Regístrate como psicólogo evaluador</p>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input {...register('firstName')} type="text" className={inputClass} placeholder="Laura" />
              {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <input {...register('lastName')} type="text" className={inputClass} placeholder="Martínez" />
              {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input {...register('email')} type="email" autoComplete="email" className={inputClass} placeholder="evaluador@empresa.com" />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <div className="relative">
              <input {...register('password')} type={showPassword ? 'text' : 'password'} className={`${inputClass} pr-10`} placeholder="••••••••" />
              <button type="button" className="absolute inset-y-0 right-0 flex items-center pr-3" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeSlashIcon className="h-4 w-4 text-gray-400" /> : <EyeIcon className="h-4 w-4 text-gray-400" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Contraseña</label>
            <input {...register('confirmPassword')} type={showPassword ? 'text' : 'password'} className={inputClass} placeholder="••••••••" />
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

      <p className="mt-8 text-xs text-gray-400 text-center max-w-xs">
        Basado en la Batería de Riesgo Psicosocial — Resolución 2646 de 2008
      </p>
    </div>
  );
}
