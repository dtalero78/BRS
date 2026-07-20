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

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => { loadAnalytics(); }, []);
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