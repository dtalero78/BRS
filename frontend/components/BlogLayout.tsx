import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';

interface BlogLayoutProps {
  title: string;
  description: string;
  slug: string;
  date: string;
  readTime: string;
  keywords: string;
  children: React.ReactNode;
}

export default function BlogLayout({ title, description, slug, date, readTime, keywords, children }: BlogLayoutProps) {
  const siteUrl = 'https://bateriariesgopsicosocial.com';
  const fullUrl = `${siteUrl}/blog/${slug}/`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    url: fullUrl,
    datePublished: date,
    dateModified: date,
    author: {
      '@type': 'Organization',
      name: 'BRS Digital',
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'BRS Digital',
      logo: { '@type': 'ImageObject', url: `${siteUrl}/logo.png` },
    },
    image: `${siteUrl}/seoImagen.png`,
    inLanguage: 'es-CO',
    mainEntityOfPage: { '@type': 'WebPage', '@id': fullUrl },
  };

  return (
    <div className="min-h-screen bg-white">
      <Head>
        <title>{title} | BRS Digital Blog</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        <link rel="canonical" href={fullUrl} />

        <meta property="og:type" content="article" />
        <meta property="og:locale" content="es_CO" />
        <meta property="og:site_name" content="BRS Digital" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={fullUrl} />
        <meta property="og:image" content={`${siteUrl}/seoImagen.png`} />
        <meta property="article:published_time" content={date} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={`${siteUrl}/seoImagen.png`} />

        <meta name="geo.region" content="CO" />

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>

      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 lg:px-16 py-4 bg-white border-b border-gray-100 shadow-sm">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="BRS Digital - Software Bateria de Riesgo Psicosocial" width={210} height={60} className="h-[60px] w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/blog" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
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

      {/* Breadcrumb */}
      <div className="max-w-3xl mx-auto px-6 pt-8">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/" className="hover:text-gray-600 transition-colors">Inicio</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-gray-600 transition-colors">Blog</Link>
          <span>/</span>
          <span className="text-gray-600 truncate max-w-xs">{title}</span>
        </nav>
      </div>

      {/* Article */}
      <article className="max-w-3xl mx-auto px-6 py-10">
        <header className="mb-10">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-4">
            {title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <time dateTime={date}>{new Date(date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
            <span>·</span>
            <span>{readTime} de lectura</span>
          </div>
        </header>

        <div className="prose prose-lg prose-gray max-w-none
          prose-headings:text-gray-900 prose-headings:font-bold
          prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
          prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-gray-600 prose-p:leading-relaxed prose-p:mb-4
          prose-li:text-gray-600
          prose-strong:text-gray-900
          prose-table:text-sm
          [&_table]:w-full [&_table]:border-collapse
          [&_th]:bg-gray-50 [&_th]:border [&_th]:border-gray-200 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-gray-900
          [&_td]:border [&_td]:border-gray-200 [&_td]:px-4 [&_td]:py-2
        ">
          {children}
        </div>
      </article>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="rounded-2xl px-8 py-10 text-center text-white" style={{ backgroundColor: '#0a2d4e' }}>
          <h2 className="text-2xl font-bold mb-3">Aplica la Bateria de Riesgo Psicosocial digitalmente</h2>
          <p className="text-gray-400 mb-6">Cuestionarios digitales, calculos automaticos y reportes PDF. Comienza gratis.</p>
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
            <a href="#" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
