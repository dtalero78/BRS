import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { marketingOnly } from '../../components/MarketingGate';

const articles = [
  {
    slug: 'baremos-oficiales-bateria-riesgo-psicosocial',
    title: 'Baremos oficiales de la Bateria de Riesgo Psicosocial: Tablas 29 a 34',
    description: 'Explicacion completa de los baremos oficiales (Tablas 29-34) de la bateria de riesgo psicosocial. Como usarlos, baremos duales para extralaboral y estres, y errores comunes.',
    date: '2026-03-30',
    readTime: '9 min',
  },
  {
    slug: 'que-es-riesgo-psicosocial-laboral',
    title: 'Que es el riesgo psicosocial laboral y por que importa en Colombia',
    description: 'Definicion del riesgo psicosocial laboral, tipos de factores de riesgo, consecuencias para trabajadores y empresas, y obligaciones legales en Colombia.',
    date: '2026-03-29',
    readTime: '8 min',
  },
  {
    slug: 'guia-aplicar-bateria-riesgo-psicosocial',
    title: 'Guia completa: Como aplicar la Bateria de Riesgo Psicosocial en 2026',
    description: 'Paso a paso para aplicar la bateria de riesgo psicosocial en Colombia. Requisitos, cuestionarios, baremos oficiales y como interpretar los resultados.',
    date: '2026-03-28',
    readTime: '10 min',
  },
  {
    slug: 'cuestionario-estres-laboral-bateria-psicosocial',
    title: 'Cuestionario de estres laboral: Guia completa de la bateria psicosocial',
    description: 'Todo sobre el cuestionario de estres de la bateria de riesgo psicosocial: escala de 4 puntos, sintomas, calificacion ponderada e interpretacion de resultados.',
    date: '2026-03-27',
    readTime: '8 min',
  },
  {
    slug: 'plan-intervencion-riesgo-psicosocial',
    title: 'Como elaborar un plan de intervencion de riesgo psicosocial efectivo',
    description: 'Guia practica para construir un plan de intervencion de riesgo psicosocial a partir de los resultados de la bateria. Tipos de intervencion y priorizacion.',
    date: '2026-03-26',
    readTime: '9 min',
  },
  {
    slug: 'resolucion-2764-de-2022-que-cambio',
    title: 'Resolucion 2764 de 2022: Que cambio y como cumplir',
    description: 'Analisis de la Resolucion 2764 de 2022 del Ministerio del Trabajo. Cambios respecto a la Resolucion 2646 de 2008 y como cumplir con la normativa actualizada.',
    date: '2026-03-25',
    readTime: '8 min',
  },
  {
    slug: 'dimensiones-dominios-bateria-riesgo-psicosocial',
    title: 'Las 45 dimensiones y 10 dominios de la Bateria de Riesgo Psicosocial',
    description: 'Lista completa de las 45 dimensiones y 10 dominios de la bateria de riesgo psicosocial. Que mide cada dimension, a que forma pertenece y ejemplos practicos.',
    date: '2026-03-24',
    readTime: '10 min',
  },
  {
    slug: 'diferencias-forma-a-forma-b-intralaboral',
    title: 'Diferencias entre Forma A y Forma B del cuestionario intralaboral',
    description: 'Explicacion detallada de cuando usar Forma A o Forma B del cuestionario de factores de riesgo psicosocial intralaboral. Dimensiones, items y criterios de seleccion.',
    date: '2026-03-22',
    readTime: '7 min',
  },
  {
    slug: 'niveles-riesgo-psicosocial-como-interpretarlos',
    title: 'Los 5 niveles de riesgo psicosocial: Como interpretarlos',
    description: 'Guia para interpretar los 5 niveles de riesgo psicosocial: sin riesgo, riesgo bajo, medio, alto y muy alto. Que significan y que acciones tomar en cada caso.',
    date: '2026-03-19',
    readTime: '6 min',
  },
  {
    slug: 'software-vs-excel-bateria-psicosocial',
    title: 'Software vs Excel: Por que digitalizar la bateria psicosocial',
    description: 'Comparativa entre aplicar la bateria de riesgo psicosocial con Excel vs software especializado. Ventajas, desventajas y costos reales para psicologos.',
    date: '2026-03-16',
    readTime: '5 min',
  },
];

const siteUrl = 'https://bateriariesgopsicosocial.com';

function BlogIndex() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Blog BRS Digital - Bateria de Riesgo Psicosocial Colombia',
    description: 'Articulos y guias sobre la bateria de riesgo psicosocial en Colombia para psicologos ocupacionales.',
    url: `${siteUrl}/blog/`,
    inLanguage: 'es-CO',
    publisher: {
      '@type': 'Organization',
      name: 'BRS Digital',
      url: siteUrl,
    },
    blogPost: articles.map((a) => ({
      '@type': 'BlogPosting',
      headline: a.title,
      description: a.description,
      url: `${siteUrl}/blog/${a.slug}/`,
      datePublished: a.date,
    })),
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#e6f4fd' }}>
      <Head>
        <title>Blog | Bateria de Riesgo Psicosocial Colombia - BRS Digital</title>
        <meta name="description" content="Guias, articulos y recursos sobre la bateria de riesgo psicosocial en Colombia. Normativa, cuestionarios, interpretacion de resultados y herramientas digitales para psicologos ocupacionales." />
        <meta name="keywords" content="blog bateria riesgo psicosocial, guia riesgo psicosocial Colombia, resolucion 2764 2022, cuestionario intralaboral, niveles riesgo psicosocial, software psicosocial" />
        <link rel="canonical" href={`${siteUrl}/blog/`} />

        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_CO" />
        <meta property="og:site_name" content="BRS Digital" />
        <meta property="og:title" content="Blog | Bateria de Riesgo Psicosocial Colombia" />
        <meta property="og:description" content="Guias y recursos sobre la bateria de riesgo psicosocial para psicologos ocupacionales en Colombia." />
        <meta property="og:url" content={`${siteUrl}/blog/`} />
        <meta property="og:image" content={`${siteUrl}/seoImagen.png`} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Blog | Bateria de Riesgo Psicosocial Colombia" />
        <meta name="twitter:description" content="Guias y recursos sobre la bateria de riesgo psicosocial para psicologos ocupacionales en Colombia." />

        <meta name="geo.region" content="CO" />

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>

      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 lg:px-16 py-4 bg-white border-b border-gray-100 shadow-sm">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="BRS Digital - Software Bateria de Riesgo Psicosocial" width={210} height={60} className="h-[60px] w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/blog" className="text-sm font-medium text-gray-900">
            Blog
          </Link>
          <Link href="/auth/login" className="text-sm font-medium text-gray-800 border border-gray-400 rounded-full px-5 py-2 hover:border-gray-700 transition-all">
            Iniciar sesion
          </Link>
          <Link href="/auth/register" className="text-sm font-medium text-white bg-gray-900 rounded-full px-5 py-2 hover:bg-gray-700 transition-colors">
            Comenzar gratis
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-screen-xl mx-auto px-8 lg:px-16 pt-16 pb-10 text-center">
        <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
          Blog BRS Digital
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          Guias y recursos sobre la bateria de riesgo psicosocial en Colombia para psicologos ocupacionales.
        </p>
      </div>

      {/* Articles */}
      <div className="max-w-screen-xl mx-auto px-8 lg:px-16 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/blog/${article.slug}`}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                <time dateTime={article.date}>
                  {new Date(article.date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                </time>
                <span>·</span>
                <span>{article.readTime}</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 group-hover:text-blue-700 transition-colors leading-snug">
                {article.title}
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                {article.description}
              </p>
              <div className="mt-4 text-sm font-medium text-blue-600 group-hover:text-blue-800 transition-colors">
                Leer articulo →
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #b3d4ed', backgroundColor: '#daeefa' }} className="px-8 lg:px-16 py-8">
        <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-ibrand text-lg text-gray-700">BRS Digital</span>
          <p className="text-xs text-gray-400 text-center">
            Software basado en la Bateria de Riesgo Psicosocial del Ministerio de la Proteccion Social de Colombia
          </p>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Inicio</Link>
            <a href="#" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default marketingOnly(BlogIndex);
