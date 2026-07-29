import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { marketingOnly } from '../components/MarketingGate';

function Terminos() {
  const siteUrl = 'https://bateriariesgopsicosocial.com';
  const pageTitle = 'Terminos y Condiciones | BRS Digital';
  const pageDescription = 'Terminos y condiciones de uso de BRS Digital, plataforma SaaS para la evaluacion de riesgo psicosocial en Colombia. Descripcion del servicio, cuentas, uso aceptable y responsabilidades.';
  const fullUrl = `${siteUrl}/terminos/`;

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
          <span className="text-gray-600">Terminos y Condiciones</span>
        </nav>
      </div>

      {/* Content */}
      <article className="max-w-3xl mx-auto px-6 py-10">
        <header className="mb-10">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-4">
            Terminos y Condiciones
          </h1>
          <p className="text-sm text-gray-400">Ultima actualizacion: 7 de abril de 2026</p>
        </header>

        <div className="prose prose-lg prose-gray max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-p:text-gray-600 prose-p:leading-relaxed prose-p:mb-4 prose-li:text-gray-600 prose-strong:text-gray-900">

          <p>
            Bienvenido a BRS Digital. Al acceder y utilizar nuestra plataforma, aceptas los presentes terminos y condiciones. Te recomendamos leerlos detenidamente antes de usar el servicio. Si no estas de acuerdo con alguno de estos terminos, te pedimos que no utilices la plataforma.
          </p>

          <h2>1. Descripcion del servicio</h2>
          <p>
            BRS Digital es una plataforma SaaS (Software como Servicio) disenada para psicologos ocupacionales en Colombia. Permite aplicar digitalmente la Bateria de Instrumentos para la Evaluacion de Factores de Riesgo Psicosocial del Ministerio de la Proteccion Social, incluyendo:
          </p>
          <ul>
            <li>Aplicacion digital de los cuestionarios oficiales (intralaboral Forma A y B, extralaboral, estres y ficha sociodemografica).</li>
            <li>Calculo automatico de puntajes transformados con los baremos oficiales del Ministerio.</li>
            <li>Clasificacion de niveles de riesgo por dimension, dominio y puntaje total.</li>
            <li>Generacion de reportes PDF individuales y organizacionales.</li>
            <li>Gestion multi-empresa para evaluadores independientes.</li>
          </ul>

          <h2>2. Cuentas de usuario</h2>
          <p>
            Para utilizar BRS Digital, debes crear una cuenta proporcionando informacion veraz y actualizada. Eres responsable de:
          </p>
          <ul>
            <li>Mantener la confidencialidad de tu contrasena y credenciales de acceso.</li>
            <li>Todas las actividades que se realicen bajo tu cuenta.</li>
            <li>Notificarnos de inmediato si detectas un uso no autorizado de tu cuenta.</li>
            <li>Asegurarte de que la informacion de tu perfil sea precisa y este actualizada.</li>
          </ul>
          <p>
            Nos reservamos el derecho de suspender o cancelar cuentas que violen estos terminos o que permanezcan inactivas por un periodo prolongado.
          </p>

          <h2>3. Uso aceptable</h2>
          <p>
            Al utilizar BRS Digital, te comprometes a:
          </p>
          <ul>
            <li>Usar la plataforma exclusivamente para la evaluacion de riesgo psicosocial conforme a la normativa colombiana vigente.</li>
            <li>Contar con la licencia profesional requerida para aplicar la bateria de riesgo psicosocial (psicologo con licencia en SST o especializacion equivalente).</li>
            <li>Garantizar la confidencialidad de los datos de los participantes evaluados.</li>
            <li>No intentar acceder a datos de otros evaluadores o empresas que no te pertenezcan.</li>
            <li>No realizar ingenieria inversa, descompilar ni intentar extraer el codigo fuente de la plataforma.</li>
            <li>No usar la plataforma para actividades ilegales o que violen derechos de terceros.</li>
            <li>No sobrecargar intencionalmente los servidores ni realizar ataques de denegacion de servicio.</li>
          </ul>

          <h2>4. Precios y pagos</h2>
          <p>
            BRS Digital opera bajo un modelo de pago por evaluacion. Los detalles especificos de precios son:
          </p>
          <ul>
            <li>El registro en la plataforma es gratuito.</li>
            <li>El costo se cobra por cada evaluacion aplicada (conjunto de cuestionarios por participante).</li>
            <li>Los precios vigentes estan disponibles en la plataforma y pueden actualizarse con previo aviso.</li>
            <li>Los pagos realizados no son reembolsables una vez que la evaluacion ha sido iniciada por el participante.</li>
          </ul>
          <p>
            Nos reservamos el derecho de modificar los precios del servicio. Cualquier cambio sera notificado con al menos 30 dias de anticipacion.
          </p>

          <h2>5. Propiedad intelectual</h2>
          <p>
            Respecto a la propiedad intelectual:
          </p>
          <ul>
            <li>La Bateria de Instrumentos para la Evaluacion de Factores de Riesgo Psicosocial es propiedad del Ministerio de la Proteccion Social de Colombia y la Pontificia Universidad Javeriana.</li>
            <li>El software, diseno, interfaz, codigo fuente, algoritmos y demas elementos tecnologicos de BRS Digital son propiedad de sus desarrolladores y estan protegidos por las leyes de propiedad intelectual de Colombia.</li>
            <li>Los datos que ingreses en la plataforma (informacion de empresas, participantes, respuestas y resultados) son de tu propiedad como evaluador.</li>
            <li>No se te otorga ninguna licencia sobre el software mas alla del derecho de uso conforme a estos terminos.</li>
          </ul>

          <h2>6. Limitacion de responsabilidad</h2>
          <p>
            BRS Digital se proporciona "tal cual" y "segun disponibilidad". En la medida permitida por la ley colombiana:
          </p>
          <ul>
            <li>No garantizamos que el servicio sea ininterrumpido, libre de errores o completamente seguro.</li>
            <li>No somos responsables de las interpretaciones clinicas ni de las decisiones que el evaluador tome con base en los resultados generados por la plataforma.</li>
            <li>La responsabilidad profesional de la aplicacion e interpretacion de la bateria recae exclusivamente en el psicologo evaluador.</li>
            <li>No seremos responsables por danos indirectos, incidentales, especiales o consecuentes derivados del uso o la imposibilidad de uso de la plataforma.</li>
            <li>Nuestra responsabilidad total frente a cualquier reclamacion no excedera el monto pagado por el usuario durante los 12 meses anteriores al evento que dio origen a la reclamacion.</li>
          </ul>

          <h2>7. Disponibilidad del servicio</h2>
          <p>
            Nos esforzamos por mantener la plataforma disponible de forma continua. Sin embargo:
          </p>
          <ul>
            <li>Podemos realizar mantenimientos programados que impliquen interrupciones temporales del servicio.</li>
            <li>No somos responsables por interrupciones causadas por factores fuera de nuestro control (fallas de internet, desastres naturales, problemas del proveedor de infraestructura).</li>
            <li>Realizamos copias de seguridad periodicas, pero recomendamos descargar tus reportes PDF como respaldo adicional.</li>
          </ul>

          <h2>8. Terminacion</h2>
          <p>
            Cualquiera de las partes puede terminar la relacion de servicio:
          </p>
          <ul>
            <li><strong>Por el usuario</strong>: puedes solicitar la cancelacion de tu cuenta en cualquier momento contactandonos por correo electronico. Tus datos seran eliminados conforme a nuestra <Link href="/privacidad">politica de privacidad</Link>.</li>
            <li><strong>Por BRS Digital</strong>: podemos suspender o cancelar tu cuenta si violas estos terminos, si usas la plataforma de forma fraudulenta o si asi lo requiere una autoridad competente.</li>
          </ul>
          <p>
            En caso de terminacion, los datos podran ser conservados durante el tiempo requerido por la normativa colombiana aplicable.
          </p>

          <h2>9. Modificaciones a los terminos</h2>
          <p>
            Nos reservamos el derecho de modificar estos terminos y condiciones en cualquier momento. Los cambios seran publicados en esta pagina con la fecha de actualizacion correspondiente. El uso continuado de la plataforma despues de la publicacion de los cambios constituye tu aceptacion de los terminos modificados.
          </p>

          <h2>10. Ley aplicable y jurisdiccion</h2>
          <p>
            Estos terminos se rigen por las leyes de la Republica de Colombia. Cualquier controversia derivada del uso de la plataforma sera resuelta ante los tribunales competentes de la ciudad de Barranquilla, Colombia, salvo que la ley aplicable disponga lo contrario.
          </p>

          <h2>11. Contacto</h2>
          <p>
            Para cualquier pregunta o inquietud sobre estos terminos y condiciones, puedes contactarnos a traves de:
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
            <Link href="/privacidad" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Privacidad</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default marketingOnly(Terminos);
