import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import '../styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Carga Google Analytics + Microsoft Clarity SOLO fuera de las rutas de
// participante. En /participant/... el access_token viaja en la URL y no debe
// enviarse a terceros (GA registra el page_path; Clarity graba session replay).
function loadAnalytics() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/participant/')) return;
  if ((window as any).__brsAnalyticsLoaded) return;
  (window as any).__brsAnalyticsLoaded = true;

  const ga = document.createElement('script');
  ga.async = true;
  ga.src = 'https://www.googletagmanager.com/gtag/js?id=G-KT5D58PW0N';
  document.head.appendChild(ga);
  (window as any).dataLayer = (window as any).dataLayer || [];
  const gtag = (...args: any[]) => { (window as any).dataLayer.push(args); };
  (window as any).gtag = gtag;
  gtag('js', new Date());
  gtag('config', 'G-KT5D58PW0N');

  (function (c: any, l: any, a: any, r: any, i: any) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    const t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
    const y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', 'w7iw3jubtg');
}

// Manejo global de sesión expirada: los ~75 fetch sueltos del frontend no pasan
// por el helper apiCall (config/api.ts), así que sus respuestas 401 quedaban sin
// manejar y el usuario se quedaba atrapado en un error genérico. Este wrapper
// intercepta CUALQUIER fetch a /api/: ante un 401 intenta un refresh del token una
// vez y reintenta; si el refresh falla, limpia la sesión y manda al login.
// No afecta a participantes (usan token de URL, no sesión JWT) ni a rutas de auth.
function installAuthExpiryHandler() {
  if (typeof window === 'undefined') return;
  if ((window as any).__brsFetchPatched) return;
  (window as any).__brsFetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: any, init?: any) => {
    const res = await originalFetch(input, init);
    try {
      if (res.status !== 401) return res;
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (!url.includes('/api/') || url.includes('/api/auth/')) return res;
      const path = window.location.pathname;
      if (path.startsWith('/auth/') || path.startsWith('/participant/')) return res;
      const token = localStorage.getItem('token');
      if (!token) return res; // no es una sesión de evaluador/admin

      // Intentar refrescar el token una vez y reintentar la petición original.
      if (typeof input === 'string') {
        const refresh = await originalFetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        });
        if (refresh.ok) {
          const data = await refresh.json().catch(() => ({}));
          if (data && data.token) {
            localStorage.setItem('token', data.token);
            const retryInit = { ...(init || {}), headers: { ...((init && init.headers) || {}), 'Authorization': `Bearer ${data.token}` } };
            return await originalFetch(input, retryInit);
          }
        }
      }

      // Refresh falló o no aplicable → sesión terminada.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/auth/login';
    } catch (e) {
      // No romper la respuesta por un fallo del handler.
    }
    return res;
  };
}

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => { loadAnalytics(); installAuthExpiryHandler(); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <Component {...pageProps} />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}