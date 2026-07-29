import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { marketingOnly } from '../components/MarketingGate';

function Privacidad() {
  const siteUrl = 'https://bateriariesgopsicosocial.com';
  const pageTitle = 'Politica de Privacidad | BRS Digital';
  const pageDescription = 'Politica de privacidad de BRS Digital. Conoce como recopilamos, usamos y protegemos tus datos en nuestra plataforma de evaluacion de riesgo psicosocial en Colombia.';
  const fullUrl = `${siteUrl}/privacidad/`;

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
          <span className="text-gray-600">Politica de Privacidad</span>
        </nav>
      </div>

      {/* Content */}
      <article className="max-w-3xl mx-auto px-6 py-10">
        <header className="mb-10">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-4">
            Politica de Privacidad
          </h1>
          <p className="text-sm text-gray-400">Ultima actualizacion: 7 de abril de 2026</p>
        </header>

        <div className="prose prose-lg prose-gray max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-p:text-gray-600 prose-p:leading-relaxed prose-p:mb-4 prose-li:text-gray-600 prose-strong:text-gray-900">

          <p>
            En BRS Digital nos comprometemos a proteger la privacidad y confidencialidad de los datos de nuestros usuarios. Esta politica describe como recopilamos, usamos, almacenamos y protegemos tu informacion personal cuando utilizas nuestra plataforma de evaluacion de riesgo psicosocial.
          </p>

          <h2>1. Informacion que recopilamos</h2>
          <p>
            Recopilamos la siguiente informacion cuando utilizas BRS Digital:
          </p>
          <ul>
            <li><strong>Datos de registro</strong>: nombre, correo electronico y contrasena al crear tu cuenta como psicologo evaluador.</li>
            <li><strong>Datos de empresas</strong>: nombre, NIT, correo de contacto y telefono de las empresas que registras en la plataforma.</li>
            <li><strong>Datos de participantes</strong>: correo electronico e informacion sociodemografica (genero, edad, escolaridad, cargo, antiguedad, entre otros) proporcionada por los participantes al completar la ficha de datos.</li>
            <li><strong>Respuestas a cuestionarios</strong>: las respuestas a los cuestionarios de la Bateria de Riesgo Psicosocial (intralaboral, extralaboral, estres y ficha sociodemografica).</li>
            <li><strong>Resultados calculados</strong>: puntajes transformados, niveles de riesgo y clasificaciones derivados de las respuestas.</li>
            <li><strong>Datos de uso</strong>: informacion tecnica como direccion IP, tipo de navegador, paginas visitadas y tiempo de sesion, recopilada automaticamente mediante cookies y herramientas de analitica.</li>
          </ul>

          <h2>2. Uso de la informacion</h2>
          <p>
            Utilizamos la informacion recopilada para los siguientes fines:
          </p>
          <ul>
            <li>Proveer el servicio de evaluacion de riesgo psicosocial, incluyendo la aplicacion de cuestionarios, calculo de resultados y generacion de reportes PDF.</li>
            <li>Administrar tu cuenta y gestionar el acceso a la plataforma.</li>
            <li>Mejorar la experiencia del usuario y optimizar el rendimiento de la plataforma.</li>
            <li>Cumplir con obligaciones legales y regulatorias aplicables en Colombia.</li>
            <li>Enviar comunicaciones relacionadas con el servicio (actualizaciones, notificaciones de seguridad).</li>
          </ul>

          <h2>3. Almacenamiento y seguridad de los datos</h2>
          <p>
            Todos los datos se almacenan en una base de datos PostgreSQL gestionada por DigitalOcean, con conexion cifrada mediante SSL. Aplicamos las siguientes medidas de seguridad:
          </p>
          <ul>
            <li>Cifrado de contrasenas mediante bcrypt (hash unidireccional).</li>
            <li>Autenticacion basada en tokens JWT con expiracion automatica.</li>
            <li>Conexiones cifradas (HTTPS) en toda la plataforma.</li>
            <li>Aislamiento de datos entre evaluadores: cada psicologo solo puede acceder a las empresas y datos que el mismo ha creado.</li>
            <li>Limitacion de tasa de peticiones (rate limiting) para prevenir abusos.</li>
          </ul>

          <h2>4. Confidencialidad de los resultados</h2>
          <p>
            Los resultados de las evaluaciones de riesgo psicosocial son estrictamente confidenciales. De acuerdo con la Resolucion 2646 de 2008 y la Resolucion 2764 de 2022:
          </p>
          <ul>
            <li>Los resultados individuales solo son accesibles para el psicologo evaluador que realizo la evaluacion.</li>
            <li>Los reportes organizacionales presentan datos agregados que no permiten identificar a participantes individuales.</li>
            <li>No compartimos resultados individuales con empleadores ni con terceros sin el consentimiento del participante.</li>
            <li>Los datos de evaluacion no se utilizan para tomar decisiones laborales que perjudiquen a los trabajadores.</li>
          </ul>

          <h2>5. Cookies y herramientas de analitica</h2>
          <p>
            BRS Digital utiliza las siguientes tecnologias de seguimiento:
          </p>
          <ul>
            <li><strong>Google Analytics</strong>: para analizar el trafico del sitio web, las paginas mas visitadas y el comportamiento general de navegacion. Google Analytics utiliza cookies para recopilar esta informacion de forma anonima.</li>
            <li><strong>Microsoft Clarity</strong>: para comprender como los usuarios interactuan con la plataforma mediante mapas de calor y grabaciones de sesion. Clarity no captura datos personales sensibles.</li>
          </ul>
          <p>
            Puedes desactivar las cookies desde la configuracion de tu navegador, aunque esto podria afectar algunas funcionalidades de la plataforma.
          </p>

          <h2>6. Retencion de datos</h2>
          <p>
            Conservamos tus datos mientras tu cuenta este activa y durante el tiempo necesario para cumplir con los fines descritos en esta politica. En particular:
          </p>
          <ul>
            <li>Los datos de cuenta se conservan mientras mantengas tu registro activo en la plataforma.</li>
            <li>Las respuestas y resultados de evaluaciones se conservan durante el periodo requerido por la normativa colombiana en materia de seguridad y salud en el trabajo.</li>
            <li>Puedes solicitar la eliminacion de tu cuenta y datos asociados en cualquier momento contactandonos por correo electronico.</li>
          </ul>

          <h2>7. Derechos del usuario</h2>
          <p>
            De acuerdo con la Ley 1581 de 2012 (Ley de Proteccion de Datos Personales de Colombia), tienes derecho a:
          </p>
          <ul>
            <li><strong>Acceso</strong>: conocer los datos personales que tenemos sobre ti.</li>
            <li><strong>Rectificacion</strong>: solicitar la correccion de datos inexactos o incompletos.</li>
            <li><strong>Cancelacion</strong>: solicitar la eliminacion de tus datos personales cuando ya no sean necesarios.</li>
            <li><strong>Oposicion</strong>: oponerte al tratamiento de tus datos para fines especificos.</li>
            <li><strong>Portabilidad</strong>: solicitar una copia de tus datos en un formato estructurado.</li>
          </ul>
          <p>
            Para ejercer cualquiera de estos derechos, contactanos a traves de los canales indicados en la seccion de contacto.
          </p>

          <h2>8. Comparticion de datos con terceros</h2>
          <p>
            No vendemos, alquilamos ni compartimos tus datos personales con terceros, excepto en los siguientes casos:
          </p>
          <ul>
            <li>Proveedores de infraestructura tecnologica (DigitalOcean) que alojan nuestros servidores y bases de datos, sujetos a sus propias politicas de privacidad y acuerdos de confidencialidad.</li>
            <li>Cuando sea requerido por ley, orden judicial o autoridad competente en Colombia.</li>
            <li>Herramientas de analitica (Google Analytics, Microsoft Clarity) que procesan datos de forma anonima y agregada.</li>
          </ul>

          <h2>9. Cambios en esta politica</h2>
          <p>
            Nos reservamos el derecho de actualizar esta politica de privacidad en cualquier momento. Cualquier cambio sera publicado en esta pagina con la fecha de actualizacion correspondiente. Te recomendamos revisar esta politica periodicamente.
          </p>

          <h2>10. Contacto</h2>
          <p>
            Si tienes preguntas, inquietudes o solicitudes relacionadas con esta politica de privacidad o el tratamiento de tus datos personales, puedes contactarnos a traves de:
          </p>
          <ul>
            <li><strong>Correo electronico</strong>: <a href="mailto:contacto@bateriariesgopsicosocial.com">contacto@bateriariesgopsicosocial.com</a></li>
            <li><strong>WhatsApp</strong>: <a href="https://wa.me/573008021701" target="_blank" rel="noopener noreferrer">+57 300 802 1701</a></li>
          </ul>
        </div>
      </article>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #e5e7eb' }} className="px-8 lg:px-16 py-8 bg-gray-50">
        <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-ibrand text-lg text-gray-700">BRS Digital</span>
          <p className="text-xs text-gray-400 text-center">
            Software basado en la Bateria de Riesgo Psicosocial del Ministerio de la Proteccion Social de Colombia
          </p>
          <div className="flex items-center gap-6">
            <Link href="/blog" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Blog</Link>
            <Link href="/contacto" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Contacto</Link>
            <Link href="/terminos" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Terminos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default marketingOnly(Privacidad);
