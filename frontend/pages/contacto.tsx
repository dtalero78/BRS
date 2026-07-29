import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { marketingOnly } from '../components/MarketingGate';

function Contacto() {
  const siteUrl = 'https://bateriariesgopsicosocial.com';
  const pageTitle = 'Contacto | BRS Digital';
  const pageDescription = 'Contacta al equipo de BRS Digital. Escribenos por WhatsApp o correo electronico para resolver tus dudas sobre la plataforma de evaluacion de riesgo psicosocial.';
  const fullUrl = `${siteUrl}/contacto/`;

  return (
    <div className="min-h-screen bg-white">
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={fullUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_CO" />
        <meta property="og:site_name" content="BRS Digital" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={fullUrl} />
        <meta property="og:image" content={`${siteUrl}/seoImagen.png`} />
        <meta name="geo.region" content="CO" />
      </Head>

      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 lg:px-16 py-4 bg-white border-b border-gray-100 shadow-sm">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="BRS Digital - Software Bateria de Riesgo Psicosocial" width={210} height={60} className="h-[60px] w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm font-medium text-gray-800 border border-gray-400 rounded-full px-5 py-2 hover:border-gray-700 transition-all">
            Iniciar sesion
          </Link>
          <Link href="/auth/register" className="text-sm font-medium text-white bg-gray-900 rounded-full px-5 py-2 hover:bg-gray-700 transition-colors">
            Comenzar gratis
          </Link>
        </div>
      </nav>

      {/* Breadcrumb */}
      <div className="max-w-3xl mx-auto px-6 pt-8">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/" className="hover:text-gray-600 transition-colors">Inicio</Link>
          <span>/</span>
          <span className="text-gray-600">Contacto</span>
        </nav>
      </div>

      {/* Content */}
      <article className="max-w-3xl mx-auto px-6 py-10">
        <header className="mb-10">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-4">
            Contacto
          </h1>
          <p className="text-lg text-gray-500">
            Estamos aqui para ayudarte. Si tienes preguntas sobre la plataforma, necesitas soporte tecnico o quieres conocer mas sobre nuestros planes, no dudes en escribirnos.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* WhatsApp */}
          <a
            href="https://wa.me/573008021701"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-50 rounded-2xl p-8 border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all group"
          >
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">WhatsApp</h2>
            <p className="text-gray-500 text-sm mb-3">Respuesta rapida en horario laboral</p>
            <span className="text-green-600 font-medium text-sm group-hover:underline">+57 300 802 1701</span>
          </a>

          {/* Email */}
          <a
            href="mailto:contacto@bateriariesgopsicosocial.com"
            className="bg-gray-50 rounded-2xl p-8 border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all group"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Correo electronico</h2>
            <p className="text-gray-500 text-sm mb-3">Para consultas detalladas o formales</p>
            <span className="text-blue-600 font-medium text-sm group-hover:underline">contacto@bateriariesgopsicosocial.com</span>
          </a>
        </div>

        {/* Location */}
        <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100 mb-12">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Ubicacion</h2>
              <p className="text-gray-500">Barranquilla, Colombia</p>
            </div>
          </div>
        </div>

        {/* Additional info */}
        <div className="prose prose-lg prose-gray max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-p:text-gray-600 prose-p:leading-relaxed prose-p:mb-4 prose-li:text-gray-600 prose-strong:text-gray-900">
          <h2>Como podemos ayudarte</h2>
          <p>
            Nuestro equipo esta disponible para asistirte en todo lo relacionado con la plataforma BRS Digital:
          </p>
          <ul>
            <li><strong>Soporte tecnico</strong>: resolvemos problemas de acceso, errores en la plataforma o dudas sobre el funcionamiento del sistema.</li>
            <li><strong>Consultas sobre la bateria</strong>: orientacion sobre la aplicacion de la Bateria de Riesgo Psicosocial, baremos oficiales y generacion de reportes.</li>
            <li><strong>Planes y precios</strong>: informacion sobre costos por evaluacion, planes para empresas grandes y descuentos por volumen.</li>
            <li><strong>Demostraciones</strong>: agenda una demostracion personalizada para conocer todas las funcionalidades de la plataforma.</li>
          </ul>
          <p>
            El canal mas rapido para comunicarte con nosotros es <a href="https://wa.me/573008021701" target="_blank" rel="noopener noreferrer">WhatsApp</a>. Respondemos en horario laboral de lunes a viernes, de 8:00 a.m. a 6:00 p.m. (hora Colombia).
          </p>
        </div>
      </article>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="rounded-2xl px-8 py-10 text-center text-white" style={{ backgroundColor: '#0a2d4e' }}>
          <h2 className="text-2xl font-bold mb-3">Comienza a evaluar el riesgo psicosocial hoy</h2>
          <p className="text-gray-400 mb-6">Registrate gratis y aplica la bateria oficial del Ministerio de forma digital.</p>
          <Link href="/auth/register" className="inline-flex items-center justify-center text-sm font-semibold text-gray-900 bg-white rounded-full px-8 py-3 hover:bg-gray-100 transition-colors">
            Comenzar gratis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #e5e7eb' }} className="px-8 lg:px-16 py-8 bg-gray-50">
        <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-ibrand text-lg text-gray-700">BRS Digital</span>
          <p className="text-xs text-gray-400 text-center">
            Software basado en la Bateria de Riesgo Psicosocial del Ministerio de la Proteccion Social de Colombia
          </p>
          <div className="flex items-center gap-6">
            <Link href="/blog" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Blog</Link>
            <Link href="/privacidad" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Privacidad</Link>
            <Link href="/terminos" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Terminos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default marketingOnly(Contacto);
