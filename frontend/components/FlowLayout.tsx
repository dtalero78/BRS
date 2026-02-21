import { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

interface User {
  id: number;
  email: string;
  role: 'admin' | 'evaluator' | 'participant';
  company?: {
    name: string;
  };
}

interface FlowLayoutProps {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  showBack?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
}

const maxWidthClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
};

export default function FlowLayout({
  children,
  backHref,
  backLabel = 'Volver',
  showBack = true,
  maxWidth = '3xl',
}: FlowLayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/auth/login');
      return;
    }

    try {
      setUser(JSON.parse(userData));
    } catch (error) {
      router.push('/auth/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const defaultBackHref = user ? `/${user.role}/dashboard` : '/';

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isFullWidth = maxWidth === 'full';
  const bgClass = isFullWidth ? 'bg-gray-50' : 'bg-gradient-to-br from-slate-50 to-blue-50';
  const paddingClass = isFullWidth ? 'px-6 lg:px-10' : 'px-4 sm:px-6';

  return (
    <div className={`min-h-screen ${bgClass}`}>
      {/* Top bar */}
      <header className={`h-14 flex items-center justify-between ${paddingClass}`}>
        {/* Left: Back button */}
        <div className="w-32">
          {showBack && (
            <Link
              href={backHref || defaultBackHref}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              {backLabel}
            </Link>
          )}
        </div>

        {/* Center: Logo */}
        <Link href={`/${user.role}/dashboard`} className="flex items-center">
          <span className="text-base font-ibrand text-gray-800">Batería de Riesgo Psicosocial</span>
        </Link>

        {/* Right: User + Logout */}
        <div className="w-32 flex items-center justify-end gap-3">
          <div className="hidden sm:flex items-center">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600">
              {user.email.charAt(0).toUpperCase()}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Cerrar Sesión"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Content area */}
      <main className={`${maxWidthClasses[maxWidth]} mx-auto ${paddingClass} py-8 animate-fade-in`}>
        {children}
      </main>
    </div>
  );
}
