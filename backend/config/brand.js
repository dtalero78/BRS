/**
 * Marca de la instancia (white-label).
 *
 * Todas las instancias corren el mismo código; el nombre comercial que aparece
 * en los PDF y textos generados se toma de `BRAND_NAME`. Sin la env var la
 * marca es "BRS Digital", así que producción no cambia.
 *
 * El equivalente del frontend es `frontend/config/brand.ts` (allí la variable
 * es NEXT_PUBLIC_BRAND porque se resuelve en build).
 */
const BRAND_NAME = (process.env.BRAND_NAME || 'BRS Digital').trim();

module.exports = { BRAND_NAME };
