import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="es-CO">
      <Head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#0a2d4e" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* Google Analytics y Microsoft Clarity NO se cargan aqui (era global y
            filtraba el access_token de las URLs /participant/... a terceros).
            Se cargan condicionalmente por ruta desde _app.tsx. */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
