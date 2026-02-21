import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-ibrand text-gray-900">
            Batería de Riesgo Psicosocial
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Crea tu cuenta como evaluador
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="form-label">Nombre</label>
                <input
                  {...register('firstName')}
                  type="text"
                  className="form-input"
                  placeholder="Laura"
                />
                {errors.firstName && <p className="form-error">{errors.firstName.message}</p>}
              </div>
              <div>
                <label htmlFor="lastName" className="form-label">Apellido</label>
                <input
                  {...register('lastName')}
                  type="text"
                  className="form-input"
                  placeholder="Martínez"
                />
                {errors.lastName && <p className="form-error">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="form-label">Email</label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                className="form-input"
                placeholder="evaluador@empresa.com"
              />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="form-label">Contraseña</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="form-input pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && <p className="form-error">{errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="form-label">Confirmar Contraseña</label>
              <input
                {...register('confirmPassword')}
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
              />
              {errors.confirmPassword && <p className="form-error">{errors.confirmPassword.message}</p>}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </button>
          </div>

          <div className="text-center">
            <span className="text-sm text-gray-600">
              ¿Ya tienes una cuenta?{' '}
              <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
                Iniciar Sesión
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
