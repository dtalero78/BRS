import BlogLayout from '../../components/BlogLayout';

export default function NivelesRiesgo() {
  return (
    <BlogLayout
      title="Los 5 niveles de riesgo psicosocial: Como interpretarlos"
      description="Guia para interpretar los 5 niveles de riesgo psicosocial: sin riesgo, riesgo bajo, medio, alto y muy alto. Que significan y que acciones tomar en cada caso."
      slug="niveles-riesgo-psicosocial-como-interpretarlos"
      date="2026-03-19"
      readTime="6 min"
      keywords="niveles riesgo psicosocial, interpretar resultados bateria psicosocial, sin riesgo riesgo bajo medio alto muy alto, clasificacion riesgo psicosocial, baremos bateria psicosocial"
    >
      <p>
        Despues de aplicar la <strong>Bateria de Riesgo Psicosocial</strong>, los puntajes transformados se clasifican en 5 niveles de riesgo. Entender que significa cada nivel y que acciones tomar es fundamental para que la evaluacion tenga impacto real en la organizacion.
      </p>

      <h2>Los 5 niveles de riesgo</h2>
      <p>
        La clasificacion se basa en los <strong>baremos oficiales del Ministerio de la Proteccion Social</strong> (Tablas 29 a 34 del documento de validacion). Cada nivel tiene un significado especifico y requiere acciones diferentes:
      </p>

      <h3>Nivel 1: Sin riesgo o riesgo despreciable</h3>
      <p>
        Indica que la dimension evaluada es un <strong>factor protector</strong> para el trabajador. Las condiciones en esa area son favorables y contribuyen positivamente a su bienestar.
      </p>
      <p>
        <strong>Acciones</strong>: Mantener y fortalecer las condiciones actuales. Estas dimensiones pueden servir como modelo para areas con mayor riesgo. Documentar las buenas practicas para replicarlas.
      </p>

      <h3>Nivel 2: Riesgo bajo</h3>
      <p>
        La dimension no representa un riesgo significativo pero tampoco es un factor protector consolidado. Las condiciones son aceptables pero pueden mejorar.
      </p>
      <p>
        <strong>Acciones</strong>: Implementar acciones preventivas y de promocion. Realizar monitoreo periodico para evitar que las condiciones se deterioren. No requiere intervencion prioritaria.
      </p>

      <h3>Nivel 3: Riesgo medio</h3>
      <p>
        La dimension merece <strong>observacion y atencion</strong>. Hay condiciones que pueden generar respuestas de estres moderadas. Este es un nivel de alerta que indica que las condiciones no son optimas.
      </p>
      <p>
        <strong>Acciones</strong>: Implementar programas de intervencion orientados a prevenir que el riesgo aumente. Incluir esta dimension en el plan de accion con actividades especificas. Evaluar de nuevo en el proximo ciclo.
      </p>

      <h3>Nivel 4: Riesgo alto</h3>
      <p>
        Indica una <strong>alta probabilidad de que las condiciones generen estres</strong> y afecten la salud del trabajador. Las respuestas de estres ya pueden estar presentes.
      </p>
      <p>
        <strong>Acciones</strong>: Intervencion inmediata. Identificar las causas especificas y disenar un plan de accion con plazos definidos. Considerar intervenciones individuales y organizacionales. Priorizar en el plan de intervencion.
      </p>

      <h3>Nivel 5: Riesgo muy alto</h3>
      <p>
        Es el nivel mas critico. Indica que las condiciones tienen <strong>alta probabilidad de causar efectos negativos en la salud</strong> fisica y mental del trabajador. Requiere atencion prioritaria e inmediata.
      </p>
      <p>
        <strong>Acciones</strong>: Intervencion inmediata y sostenida. Monitoreo continuo. Considerar derivacion a servicios de salud cuando sea necesario. Esta dimension debe ser la prioridad numero uno del plan de intervencion. Evaluar de nuevo en un plazo no mayor a un ano.
      </p>

      <h2>Como se calculan los niveles</h2>
      <p>
        El proceso de clasificacion sigue estos pasos:
      </p>
      <ol>
        <li><strong>Sumar puntajes brutos</strong>: Se suman las respuestas de los items que componen cada dimension (aplicando inversion en items protectores)</li>
        <li><strong>Transformar el puntaje</strong>: Se aplica la formula <code>(Puntaje bruto / Factor de transformacion) x 100</code></li>
        <li><strong>Comparar con baremos</strong>: El puntaje transformado se ubica en los rangos de la tabla de baremos correspondiente</li>
        <li><strong>Asignar el nivel</strong>: Segun el rango donde cae el puntaje, se asigna uno de los 5 niveles</li>
      </ol>

      <h2>Niveles en los diferentes cuestionarios</h2>

      <h3>Intralaboral (Forma A y B)</h3>
      <p>
        Se clasifican <strong>45 dimensiones y 10 dominios</strong> en total. Cada dimension tiene sus propios rangos de baremos. Los 4 dominios (liderazgo, control, demandas, recompensas) y el puntaje total tambien se clasifican.
      </p>

      <h3>Extralaboral</h3>
      <p>
        Se clasifican <strong>7 dimensiones</strong> y el puntaje total. Importante: los baremos son diferentes segun el grupo ocupacional:
      </p>
      <ul>
        <li>Tabla 17: Para jefes, profesionales y tecnicos</li>
        <li>Tabla 18: Para auxiliares y operarios</li>
      </ul>

      <h3>Estres</h3>
      <p>
        Se clasifica un <strong>unico puntaje total</strong>. Tambien tiene baremos duales por grupo ocupacional (Tabla 6). La metodologia de calculo del estres es diferente: usa puntuacion ponderada por item (multiplicadores de 4, 3, 2 o 1 segun el item).
      </p>

      <h2>Interpretacion a nivel organizacional</h2>
      <p>
        En el informe organizacional, los niveles se presentan como <strong>porcentajes de la poblacion</strong> en cada nivel. Por ejemplo:
      </p>
      <table>
        <thead>
          <tr>
            <th>Dimension</th>
            <th>Sin riesgo</th>
            <th>Bajo</th>
            <th>Medio</th>
            <th>Alto</th>
            <th>Muy alto</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Demandas cuantitativas</td><td>15%</td><td>20%</td><td>25%</td><td>22%</td><td>18%</td></tr>
          <tr><td>Control sobre el trabajo</td><td>30%</td><td>25%</td><td>20%</td><td>15%</td><td>10%</td></tr>
          <tr><td>Liderazgo</td><td>10%</td><td>15%</td><td>20%</td><td>30%</td><td>25%</td></tr>
        </tbody>
      </table>
      <p>
        En este ejemplo, "Liderazgo" seria la dimension prioritaria porque el <strong>55% de la poblacion esta en riesgo alto o muy alto</strong>. Este tipo de analisis es el que debe guiar el plan de intervencion.
      </p>

      <h2>El plan de intervencion basado en niveles</h2>
      <p>
        La Resolucion 2764 de 2022 exige un plan de intervencion documentado. La prioridad debe ser:
      </p>
      <ol>
        <li><strong>Riesgo muy alto</strong>: Intervencion inmediata (primeros 3 meses)</li>
        <li><strong>Riesgo alto</strong>: Intervencion a corto plazo (3-6 meses)</li>
        <li><strong>Riesgo medio</strong>: Intervencion preventiva (6-12 meses)</li>
        <li><strong>Riesgo bajo y sin riesgo</strong>: Promocion y mantenimiento (continuo)</li>
      </ol>

      <h2>Automatizar la clasificacion</h2>
      <p>
        Clasificar manualmente 45 dimensiones para decenas o cientos de trabajadores es un proceso tedioso y propenso a errores. <strong>BRS Digital</strong> calcula automaticamente los puntajes transformados, los compara contra los baremos oficiales (Tablas 29-34) y clasifica cada dimension en su nivel de riesgo correspondiente, generando graficas y reportes listos para entregar.
      </p>
    </BlogLayout>
  );
}
