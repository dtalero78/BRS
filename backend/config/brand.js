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

/**
 * Si la instancia tiene sitio comercial propio (landing, blog, legales).
 * Espejo de `hasMarketingSite` en `frontend/config/brand.ts`. En `false`,
 * `robots.txt` y `sitemap.xml` no deben invitar a indexar: la instancia es
 * una app privada y el sitemap del repo apunta al dominio de BRS.
 */
const HAS_MARKETING_SITE = process.env.BRAND_HAS_MARKETING_SITE !== 'false';

/**
 * Espacio de trabajo compartido.
 *
 * BRS es un SaaS multi-evaluador: cada psicólogo solo ve las empresas que él
 * creó (`companies.created_by`). Una instancia licenciataria es lo contrario
 * —un solo equipo de una sola consultora— y ahí ese aislamiento estorba: los
 * usuarios necesitan ver todas las empresas y evaluaciones de la instancia.
 *
 * En `true`, el ownership deja de filtrar. Sigue guardándose `created_by`
 * como rastro de quién creó cada cosa; simplemente no restringe.
 *
 * OJO: activarlo solo tiene sentido si TODOS los usuarios de la instancia
 * pertenecen a la misma organización. En una instancia con evaluadores de
 * empresas distintas, esto los deja verse entre sí.
 */
const SHARED_WORKSPACE = process.env.BRAND_SHARED_WORKSPACE === 'true';

/**
 * Cobro por evaluacion.
 *
 * BRS es un SaaS donde el evaluador paga por evaluacion: hasta que no esta
 * marcada como pagada, los informes no se descargan. Un licenciatario ya pago
 * la plataforma completa, asi que ese cobro no aplica y la guarda solo estorba.
 *
 * En `false` los informes se descargan sin exigir el marcado de pago. Por
 * defecto queda activo: produccion no cambia.
 */
const REQUIRE_PAID_EVALUATION = process.env.BRAND_REQUIRE_PAID_EVALUATION !== 'false';

module.exports = { BRAND_NAME, HAS_MARKETING_SITE, SHARED_WORKSPACE, REQUIRE_PAID_EVALUATION };
