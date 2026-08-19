/**
 * Renderiza el texto del consentimiento informado.
 *
 * Contrato mínimo para que un evaluador pueda editarlo sin saber HTML:
 *  - línea que empieza con `## ` → título de sección
 *  - línea que empieza con `- `  → viñeta
 *  - `**texto**`                 → negrita
 *  - línea en blanco             → separación de párrafos
 *
 * Se hace a mano en vez de meter una librería de markdown: el texto es de
 * origen semi-confiable (lo escribe el evaluador) y así no hay ninguna ruta
 * que inyecte HTML en la página del participante.
 */

function conNegritas(texto: string, keyBase: string) {
  // split con captura: los índices impares son el contenido entre **...**
  return texto.split(/\*\*(.+?)\*\*/g).map((parte, i) =>
    i % 2 === 1
      ? <strong key={`${keyBase}-${i}`} className="font-semibold text-gray-900">{parte}</strong>
      : <span key={`${keyBase}-${i}`}>{parte}</span>
  );
}

export default function ConsentText({ text }: { text: string }) {
  const bloques = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      {bloques.map((bloque, i) => {
        if (bloque.startsWith('## ')) {
          return (
            <h2 key={i} className="text-base font-semibold text-gray-900 pt-2">
              {bloque.slice(3).trim()}
            </h2>
          );
        }

        const lineas = bloque.split('\n');
        if (lineas.every(l => l.trim().startsWith('- '))) {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-gray-600">
              {lineas.map((l, j) => <li key={j}>{conNegritas(l.trim().slice(2), `${i}-${j}`)}</li>)}
            </ul>
          );
        }

        return (
          <p key={i} className="text-sm leading-relaxed text-gray-600">
            {conNegritas(bloque.replace(/\n/g, ' '), String(i))}
          </p>
        );
      })}
    </div>
  );
}
