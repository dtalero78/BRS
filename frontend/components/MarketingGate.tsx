import { ComponentType, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Head from 'next/head';
import { BRAND, logoBox } from '../config/brand';

/**
 * Pantalla puente para instancias sin sitio comercial: manda al login.
 *
 * El `meta refresh` cubre el caso sin JS y evita el parpadeo; el efecto
 * respeta la sesión existente y lleva a cada rol a su dashboard.
 */
export function LoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      try {
        const parsed = JSON.parse(userData);
        if (parsed.role === 'admin') return void router.replace('/admin/dashboard');
        if (parsed.role === 'evaluator') return void router.replace('/evaluator/dashboard');
        if (parsed.role === 'participant') return void router.replace('/participant/questionnaires');
      } catch (e) {
        // Sesión corrupta: cae al login.
      }
    }

    router.replace('/auth/login');
  }, [router]);

  return (
    <>
      <Head>
        <title>{BRAND.name}</title>
        <meta httpEquiv="refresh" content="0; url=/auth/login/" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BRAND.surfaceHub }}>
        <Image src={BRAND.logo} alt={BRAND.name} {...logoBox(64)} priority className="h-16 w-auto animate-pulse" />
      </div>
    </>
  );
}

/**
 * Envuelve una página del sitio comercial (landing, blog, legales).
 *
 * En marcas sin `hasMarketingSite` la página nunca se monta: se sirve el
 * puente al login. Como el flag se resuelve en build, el HTML exportado de
 * esa instancia no contiene el contenido original — importa porque las
 * páginas legales nombran a la razón social y al responsable del
 * tratamiento de datos, que no son los mismos en cada instancia.
 */
export function marketingOnly<P extends object>(Page: ComponentType<P>): ComponentType<P> {
  const Gated = (props: P) => (BRAND.hasMarketingSite ? <Page {...props} /> : <LoginRedirect />);
  Gated.displayName = `marketingOnly(${Page.displayName || Page.name || 'Page'})`;
  return Gated;
}
