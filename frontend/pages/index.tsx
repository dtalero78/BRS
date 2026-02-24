import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  const router = useRouter();
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      try {
        const parsed = JSON.parse(userData);
        if (parsed.role === 'admin') {
          router.push('/admin/dashboard');
        } else if (parsed.role === 'evaluator') {
          router.push('/evaluator/dashboard');
        } else if (parsed.role === 'participant') {
          router.push('/participant/questionnaires');
        }
      } catch (e) {
        // Invalid user data, stay on landing
      }
    }
  }, [router]);

  // Close video modal on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowVideo(false);
    };
    if (showVideo) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [showVideo]);

  // Pause video when modal closes
  useEffect(() => {
    if (!showVideo && videoRef.current) {
      videoRef.current.pause();
    }
  }, [showVideo]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#e6f4fd' }}>

      {/* Video Modal */}
      {showVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowVideo(false)}
        >
          <div
            className="relative w-full max-w-4xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowVideo(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <video
              ref={videoRef}
              src="/introVideo.mp4"
              controls
              autoPlay
              className="w-full rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 lg:px-16 py-4 bg-white border-b border-gray-100 shadow-sm">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="BRS Digital" width={210} height={60} className="h-[60px] w-auto" />
        </Link>

        {/* Nav Links - hidden on mobile */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Plataforma
          </a>
          <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Soluciones
          </a>
          <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Recursos
          </a>
          <a href="#precios" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Precios
          </a>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-gray-800 border border-gray-400 rounded-full px-5 py-2 hover:border-gray-700 hover:bg-white transition-all"
          >
            Iniciar sesión
          </Link>
          <button
            onClick={() => setShowVideo(true)}
            className="text-sm font-medium text-white bg-gray-900 rounded-full px-5 py-2 hover:bg-gray-700 transition-colors"
          >
            Ver demo
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex flex-col lg:flex-row items-center px-8 lg:px-16 pt-10 pb-20 lg:pt-16 lg:pb-28 gap-12 max-w-screen-xl mx-auto">

        {/* Left: Headline + CTAs */}
        <div className="flex-1 max-w-xl">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 mb-8 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
            <span className="text-xs text-gray-600 font-medium">
              Basado en Resolución 2646 de 2008 — Min. Protección Social
            </span>
          </div>

          <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 leading-[1.05] tracking-tight mb-6">
            Aplica la BRS a la velocidad que exigen tus clientes
          </h1>

          <p className="text-lg text-gray-500 leading-relaxed mb-10 max-w-lg">
            La plataforma para psicólogos que gestionan evaluaciones BRS en múltiples empresas: desde la aplicación del cuestionario hasta el reporte oficial, todo en un solo lugar.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-gray-900 rounded-full px-7 py-3.5 hover:bg-gray-700 transition-colors"
            >
              Comenzar gratis
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <button
              onClick={() => setShowVideo(true)}
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-gray-800 border border-gray-300 bg-white/60 rounded-full px-7 py-3.5 hover:bg-white hover:border-gray-400 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ver demo
            </button>
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-4 mt-10">
            <div className="flex -space-x-2">
              {['bg-blue-400', 'bg-emerald-400', 'bg-violet-400', 'bg-amber-400'].map((color, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full border-2 border-[#e6f4fd] ${color}`}
                />
              ))}
            </div>
            <p className="text-sm text-gray-500">
              Más de <span className="font-semibold text-gray-800">200 psicólogos</span> ya confían en BRS Digital
            </p>
          </div>
        </div>

        {/* Right: Floating Product Cards */}
        <div className="flex-1 relative min-h-[460px] w-full max-w-lg lg:max-w-none">

          {/* Card 1 – Reporte de Evaluación */}
          <div
            className="absolute top-0 left-4 w-64 bg-white rounded-2xl shadow-xl p-5 border border-gray-100"
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
                    <div
                      className={`${item.color} h-1.5 rounded-full`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2 – Niveles de Riesgo */}
          <div
            className="absolute top-24 right-0 w-56 bg-white rounded-2xl shadow-xl p-5 border border-gray-100"
            style={{ transform: 'rotate(3deg)', zIndex: 10 }}
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Niveles de Riesgo
            </p>
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
            className="absolute bottom-16 left-8 w-60 bg-white rounded-2xl shadow-xl p-5 border border-gray-100"
            style={{ transform: 'rotate(1.5deg)', zIndex: 30 }}
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Evaluación Individual
            </p>
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
            className="absolute bottom-4 right-4 w-44 bg-gray-900 rounded-2xl shadow-xl p-4 text-white"
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
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{ background: 'radial-gradient(circle, #a78bfa 0%, #60a5fa 100%)', zIndex: 1 }}
          />
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ backgroundColor: '#cce5f8' }} className="py-8">
        <div className="max-w-screen-xl mx-auto px-8 lg:px-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '282', label: 'Preguntas estructuradas' },
              { value: '45', label: 'Dimensiones implementadas' },
              { value: '10', label: 'Dominios evaluados' },
              { value: '5', label: 'Niveles de riesgo' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features section */}
      <section className="max-w-screen-xl mx-auto px-8 lg:px-16 py-24" style={{ backgroundColor: '#e6f4fd' }}>
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Todo lo que necesitas para gestionar evaluaciones
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Una plataforma completa que cubre desde la aplicación del cuestionario hasta la generación de reportes oficiales.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              ),
              title: 'Cuestionarios Digitales',
              description: 'Aplicación de los 4 cuestionarios oficiales BRS de forma digital, progresiva y segura.',
              accent: 'bg-blue-100 text-blue-700',
            },
            {
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              ),
              title: 'Cálculos Automáticos',
              description: 'Motor de cálculo con baremos oficiales del Ministerio de la Protección Social de Colombia.',
              accent: 'bg-emerald-100 text-emerald-700',
            },
            {
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              ),
              title: 'Gestión de Participantes',
              description: 'Administración completa de empresas, evaluaciones y participantes desde un solo lugar.',
              accent: 'bg-violet-100 text-violet-700',
            },
            {
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              ),
              title: 'Reportes Profesionales',
              description: 'Generación automática de reportes individuales y organizacionales en formato PDF.',
              accent: 'bg-amber-100 text-amber-700',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4 ${feature.accent}`}>
                {feature.icon}
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precios" className="max-w-screen-xl mx-auto px-8 lg:px-16 py-24" style={{ backgroundColor: '#e6f4fd' }}>
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 mb-6 shadow-sm">
            <span className="text-xs text-gray-600 font-medium">Precios simples y transparentes</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Elige el plan que se ajuste a tu práctica
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Paga solo por lo que necesitas. Todos los planes incluyen los 4 cuestionarios oficiales, cálculos automáticos y soporte.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Plan Starter */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Starter</h3>
              <p className="text-sm text-gray-500">Para empezar a conocer la plataforma</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">Gratis</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                '1 empresa',
                'Hasta 20 participantes',
                'Cuestionarios digitales',
                'Cálculos automáticos',
                'Reportes individuales',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center text-sm font-semibold text-gray-800 border border-gray-300 rounded-full px-6 py-3 hover:bg-gray-50 transition-colors"
            >
              Comenzar gratis
            </Link>
          </div>

          {/* Plan Profesional */}
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-900 shadow-lg flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-gray-900 text-white text-xs font-semibold px-3 py-1 rounded-full">Popular</span>
            </div>
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Profesional</h3>
              <p className="text-sm text-gray-500">Para psicólogos independientes</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">$99.900</span>
              <span className="text-sm text-gray-500 ml-1">/mes</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Hasta 5 empresas',
                'Hasta 150 participantes/mes',
                'Reportes organizacionales',
                'Dashboard de resultados',
                'Exportar a PDF',
                'Soporte por WhatsApp',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center text-sm font-semibold text-white bg-gray-900 rounded-full px-6 py-3 hover:bg-gray-700 transition-colors"
            >
              Comenzar ahora
            </Link>
          </div>

          {/* Plan Empresarial */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Empresarial</h3>
              <p className="text-sm text-gray-500">Para consultorios y firmas</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">$249.900</span>
              <span className="text-sm text-gray-500 ml-1">/mes</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Hasta 20 empresas',
                'Hasta 500 participantes/mes',
                'Todo lo del plan Profesional',
                'Múltiples evaluadores',
                'Dashboard organizacional',
                'Soporte prioritario',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center text-sm font-semibold text-gray-800 border border-gray-300 rounded-full px-6 py-3 hover:bg-gray-50 transition-colors"
            >
              Comenzar ahora
            </Link>
          </div>

          {/* Plan Corporativo */}
          <div className="rounded-2xl p-6 border border-gray-700 shadow-sm flex flex-col text-white" style={{ backgroundColor: '#0a2d4e' }}>
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-1">Corporativo</h3>
              <p className="text-sm text-gray-400">Para grandes operaciones</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold">A medida</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Empresas ilimitadas',
                'Participantes ilimitados',
                'Todo lo del plan Empresarial',
                'API de integración',
                'Marca blanca',
                'Gerente de cuenta dedicado',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <a
              href="https://wa.me/573008021701?text=Hola%2C%20me%20interesa%20el%20plan%20Corporativo%20de%20BRS%20Digital"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center text-sm font-semibold text-white border border-gray-500 rounded-full px-6 py-3 hover:border-gray-300 transition-colors"
            >
              Contactar ventas
            </a>
          </div>
        </div>

        {/* Pricing note */}
        <p className="text-center text-sm text-gray-400 mt-8">
          Todos los precios en COP. IVA no incluido. Cancela cuando quieras.
        </p>
      </section>

      {/* CTA Banner */}
      <section className="max-w-screen-xl mx-auto px-8 lg:px-16 pb-24">
        <div className="rounded-3xl px-10 py-16 text-center text-white relative overflow-hidden" style={{ backgroundColor: '#0a2d4e' }}>
          {/* Decorative blobs */}
          <div className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{ background: 'radial-gradient(circle, #38bdf8 0%, #0ea5e9 100%)', transform: 'translate(-30%, -30%)' }} />
          <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{ background: 'radial-gradient(circle, #7dd3fc 0%, #3b82f6 100%)', transform: 'translate(30%, 30%)' }} />

          <h2 className="text-3xl lg:text-4xl font-bold mb-4 relative z-10">
            Empieza a evaluar tu organización hoy
          </h2>
          <p className="text-gray-400 text-lg mb-8 max-w-lg mx-auto relative z-10">
            Regístrate gratis y crea tu primera evaluación en minutos. Sin tarjeta de crédito.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-gray-900 bg-white rounded-full px-8 py-3.5 hover:bg-gray-100 transition-colors"
            >
              Comenzar gratis
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white border border-gray-600 rounded-full px-8 py-3.5 hover:border-gray-400 transition-colors"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #b3d4ed', backgroundColor: '#daeefa' }} className="px-8 lg:px-16 py-8">
        <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-ibrand text-lg text-gray-700">BRS Digital</span>
          <p className="text-xs text-gray-400 text-center">
            Basado en la Batería de Riesgo Psicosocial — Resolución 2646 de 2008 — Ministerio de la Protección Social de Colombia
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Privacidad</a>
            <a href="#" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Términos</a>
            <a href="#" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
