# Auditoría técnica BRS — Plan de mejoramiento y refactorización

> Generado el 2026-07-20. Auditoría multi-agente (17 auditores en paralelo + verificación
> adversarial de cada hallazgo). 134 hallazgos brutos → 45 confirmados por panel adversarial
> completo + ~30 confirmados por revisión manual directa (el resto refutados o pendientes por
> corte de presupuesto en la corrida). Las críticas de este informe fueron **releídas a mano
> contra el código real**, no solo reportadas por un agente.

---

## 1. Veredicto

**La app NO está "sana, solo un par de ajustes". Tampoco hay que reescribirla.** El diagnóstico
honesto es: la arquitectura es correcta y el producto funciona, pero hay **un puñado de bugs de
producción que deberías arreglar esta semana**, y varios de ellos tocan justo lo que le da valor
legal al producto (el cálculo psicométrico) y la seguridad de datos de salud de trabajadores
reales (Ley 1581/2012).

Lo bueno: el modelo multi-tenant por `getOwnedCompanyIds()` está aplicado de forma consistente en
los listados y los endpoints individuales (el auditor de aislamiento no encontró un IDOR
cross-tenant explotable — el peor escenario posible **no** se materializó). El JWT usa
`process.env.JWT_SECRET` sin fallback hardcodeado. La integración server-to-server es idempotente y
race-safe. El detector de Excel es genuinamente robusto. Los baremos oficiales están bien
transcritos. Nada de esto necesita refactor.

Lo que sí duele y es real, verificado a mano:

1. **El motor de cálculo clasifica mal el riesgo en dos formas distintas** — huecos de 0.1 en los
   baremos (23+ puntajes reales caen a `riesgo_medio` por un fallback) y dimensiones con respuestas
   parciales que se dividen por el factor completo (subestima el riesgo). En un instrumento que
   produce documentos con valor ante el Ministerio de Trabajo, esto es lo más grave del informe.
2. **Un `npm run db:seed` borra la base de producción** (el seed hace `users.del()` +
   `companies.del()`), y el mismo seed publica `admin123` en un **repo público de GitHub**.
3. **El flujo del participante pierde respuestas en silencio** ante cualquier error que no sea
   rate-limit, sin avisar y sin backup.

Recomendación: **Fase 1 (abajo) sí o sí, en los próximos días.** El resto es deuda que puedes ir
pagando; casi nada justifica un refactor grande hoy — el mayor "refactor" que vale la pena es
centralizar el cliente HTTP del frontend (75 `fetch` a mano) y unificar el patrón de ownership,
pero eso es Fase 2/3, no urgente.

---

## 2. Tabla resumen (críticas y altas)

| # | Hallazgo | Sev. | Esfuerzo | Archivo |
|---|----------|------|----------|---------|
| C1 | Huecos de 0.1 en baremos → `getRiskLevel` cae a `riesgo_medio`; 23+ puntajes reales mal clasificados | 🔴 Crítica | 4h | `backend/utils/baremos-completos.js:516` |
| C2 | Dimensiones con ítems faltantes se dividen por el `maxScore` completo → subestima el riesgo | 🔴 Crítica | 1d | `backend/utils/calculate-results.js:434` |
| C3 | Seed commiteado en repo público con `admin123` **y** que borra `users`+`companies` de prod | 🔴 Crítica | 3h | `backend/seeds/001_initial_data.js:9` |
| C4 | El save del participante se traga cualquier error ≠429 → pierde respuestas sin aviso ni backup | 🔴 Crítica | 4h | `frontend/pages/participant/evaluation/[token].tsx:450` |
| A1 | `access_token` viaja en la URL y se envía a Google Analytics + Clarity (CSP desactivada) | 🟠 Alta | 3h | `frontend/pages/_document.tsx:14` + `backend/server.js:20` |
| A2 | Password de la BD de prod en `.claude/settings.json`, **sin** cobertura de `.gitignore` | 🟠 Alta | 30m | `.claude/settings.json` |
| A3 | `.xlsx` con 705 cédulas + datos de salud reales en working tree, **sin** `.gitignore` | 🟠 Alta | 30m | `fundacionsanmartinmatriz.xlsx` |
| A4 | Credenciales admin (`admin123`) e infra de prod publicadas en `CLAUDE.md` (repo público) | 🟠 Alta | 2h | `CLAUDE.md:24-33` |
| A5 | `POST /api/auth/login` sin rate-limit propio ni lockout → fuerza bruta viable | 🟠 Alta | 4h | `backend/server.js:24` |
| A6 | `POST /api/responses/` siempre devuelve 400: Joi exige UUID pero `participants.id` es serial | 🟠 Alta | 2h | `backend/routes/responses.js:10` |
| A7 | El motor no valida el rango de `response_value`: negativos o >4 entran directo al bruto | 🟠 Alta | 2h | `backend/utils/calculate-results.js:373` |
| A8 | `integration.js` resuelve empresa por **nombre** sin validar ownership → tenant equivocado | 🟠 Alta | 3h | `backend/routes/integration.js:88` |
| A9 | `integration.js` reusa un PE completado para una 2ª orden: nunca genera evaluación ni webhook | 🟠 Alta | 1d | `backend/routes/integration.js:182` |
| A10 | `parseResponseValue` invierte SIEMPRE los numéricos: un Excel en escala directa importa al revés | 🟠 Alta | 1d | `backend/utils/excel-import-detector.js:300` |
| A11 | Documento repetido dentro del Excel (o en FA y FB) revienta toda la importación con 500 | 🟠 Alta | 3h | `backend/routes/evaluations.js:768` |
| A12 | `getAtRiskDimensions` muta por referencia → el informe publica cifras A+B como si fueran Forma A | 🟠 Alta | 1h | `backend/utils/report-data-aggregator.js:331` |
| A13 | Backdoor de super-admin por email hardcodeado (`d_talero@yahoo.com`) | 🟠 Alta | 2h | `backend/middleware/auth.js:70` |
| A14 | `frontend/.next` y `node_modules` versionados pese al `.gitignore` (build artifacts en repo) | 🟠 Alta | 30m | `.gitignore` |
| A15 | Cero tests pese a `jest`+`supertest` instalados; `knexfile` sin entorno `test` | 🟠 Alta | 1d | `backend/knexfile.js:3` |

Medias y bajas: ver §5.

---

## 3. Hallazgos críticos (verificados a mano)

### C1 — Huecos de 0.1 en los baremos: el nivel más bajo se reporta como "riesgo medio"

`getRiskLevel` recorre los cinco rangos y, si el puntaje no encaja en **ninguno**, cae a un default:

```js
// backend/utils/baremos-completos.js:516-531
function getRiskLevel(score, baremos) {
  const levels = ['sin_riesgo','riesgo_bajo','riesgo_medio','riesgo_alto','riesgo_muy_alto'];
  for (const level of levels) {
    const range = baremos[level];
    if (score >= range[0] && score <= range[1]) return level;
  }
  if (score < baremos.sin_riesgo[0]) return 'sin_riesgo';
  if (score > baremos.riesgo_muy_alto[1]) return 'riesgo_muy_alto';
  return 'riesgo_medio'; // Default  ← AQUÍ
}
```

Los rangos son contiguos con saltos de 0.1 — `sin_riesgo: [0.0, 12.9]`, `riesgo_bajo: [13.0, 17.7]`.
El hueco `(12.9, 13.0)` no pertenece a ningún nivel. Y `transformScore` **redondea a 2 decimales**
(`Math.round((raw/max)*100*100)/100`, `calculate-results.js:369`), así que produce valores como
12.95 que caen justo en el hueco.

**Verificado con números reales** (script sobre las 19 dimensiones intralaborales con sus `maxScore`
oficiales): **23 puntajes brutos enteros posibles caen en un hueco y se clasifican como
`riesgo_medio`**. Ejemplos demostrados:

- `caracteristicas_liderazgo`: raw `2/52` → `3.85` → debería ser **sin riesgo**, sale **medio**.
- `control_autonomia`: raw `1/12` → `8.33` → sale **medio**.
- `capacitacion`: raw `4/12` → `33.33` → sale **medio**.

Un trabajador con el mejor puntaje posible en liderazgo puede terminar reportado en riesgo medio.
Esto contamina dimensiones, dominios y el plan de intervención del informe.

**Fix:** hacer los rangos contiguos sin huecos. Cambiar el límite superior de cada banda a
`< límite_inferior_siguiente` en vez de valores 0.1 por debajo, o comparar con `<` el inferior de la
banda siguiente. Lo más limpio: reescribir `getRiskLevel` para clasificar por umbrales inferiores
ordenados (`score < 13.0 → sin_riesgo`, `score < 17.8 → bajo`, …) en vez de rangos con gaps. Y
**eliminar el `return 'riesgo_medio'` por defecto** — que lance o loguee, porque hoy enmascara el
bug. Cubrir con un property test (ningún score en `[0,100]` debe caer al default).

---

### C2 — Respuestas parciales se dividen por el factor de transformación completo

```js
// backend/utils/calculate-results.js:427-436
dimensionData.questions.forEach(questionNumber => {
  if (responseMap[questionNumber] !== undefined) {
    rawScore += getItemScore(questionNumber, responseMap[questionNumber], invertedItems);
    answeredQuestions++;
  }
});
if (answeredQuestions === 0) continue;
const transformedScore = transformScore(rawScore, dimensionData.maxScore); // ← maxScore COMPLETO
```

Si una dimensión tiene 7 ítems (`maxScore: 28`) pero el participante respondió solo 4, el `rawScore`
sale de un máximo real de 16, pero se divide por **28**. Resultado: el puntaje transformado es
artificialmente bajo → **el riesgo se subestima de forma sistemática** cuando faltan respuestas. En
un instrumento legal, subreportar riesgo psicosocial es el peor sesgo posible.

**Fix:** decidir la política explícitamente. La correcta según la metodología del Ministerio es:
una dimensión con ítems faltantes es **inválida**, no se calcula con puntaje sesgado. Opciones:
(a) marcar la dimensión como `incompleta`/`no_calculable` si `answeredQuestions < totalQuestions` y
excluirla del informe con nota; o (b) si se acepta un mínimo de completitud, transformar contra el
`maxScore` proporcional a los ítems respondidos (`answeredQuestions * 4`) — pero esto sigue siendo
estadísticamente débil. Recomiendo (a). Hoy el campo `answeredQuestions/totalQuestions` ya se calcula
pero **se descarta al persistir** (`results.js:137`), así que ni siquiera queda rastro de que un
resultado fue parcial.

---

### C3 — Seed en repo público: borra producción y filtra `admin123`

```js
// backend/seeds/001_initial_data.js (ARCHIVO COMMITEADO en github.com/dtalero78/BRS)
exports.seed = async function(knex) {
  await knex('users').del();        // ← borra TODOS los usuarios
  await knex('companies').del();    // ← borra TODAS las empresas
  ...
  const hashedPassword = await bcrypt.hash('admin123', 10);  // ← credencial en claro en repo público
  await knex('users').insert({ email: 'admin@brsdigital.com', role: 'admin', ... });
```

Dos problemas en un archivo:

1. **Operacional (crítico):** existe `"db:seed": "cd backend && npm run db:seed"` en el `package.json`
   raíz. Según tu propia nota de memoria, `backend/.env` apunta **directo a producción**. Un
   `npm run db:seed` ejecutado por descuido **borra todos los usuarios y empresas de producción**.
   No hay guarda de entorno.
2. **Seguridad (crítico):** el repo es público y el seed documenta la credencial admin. Si el admin
   de producción sigue siendo `admin@brsdigital.com` / `admin123` (tu `CLAUDE.md` lo lista como
   cuenta de prueba vigente — A4), cualquiera con la URL tiene acceso admin total.

**Fix:** (1) Añadir guarda `if (process.env.NODE_ENV === 'production') throw new Error('seed bloqueado en prod')`
al inicio del seed. (2) Rotar YA la password del admin de producción a un valor fuerte. (3) Cambiar
el seed para leer la password de `process.env.SEED_ADMIN_PASSWORD` en vez de hardcodearla. (4)
Considerar purgar el historial git de la credencial (o al menos rotar, que es lo que de verdad
importa).

---

### C4 — El participante pierde respuestas en silencio

```js
// frontend/pages/participant/evaluation/[token].tsx:432-453
} catch (error: any) {
  if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
    if (retryCount < maxRetries) { /* backoff + retry */ }
    else {
      localStorage.setItem(backupKey, JSON.stringify(responsesToSave)); // backup SOLO para 429
    }
  } else {
    console.error('Save error:', error);   // ← cualquier otro error: se traga, sin backup, sin avisar
  }
}
```

El único camino con backup a `localStorage` y reintento es el de rate-limit (429). Para **cualquier
otro fallo** — 500 del backend, caída de red, token expirado a mitad de la batería — el error se
loguea a la consola y **desaparece**. El participante sigue respondiendo creyendo que se guarda; sus
respuestas nunca llegan y no hay copia local. En una batería de ~280 preguntas que toma 30-40
minutos, esto es pérdida de trabajo real y frustración del trabajador.

**Fix:** unificar el manejo: backup a `localStorage` en **todo** error (no solo 429), y mostrar un
toast persistente ("no pudimos guardar, revisa tu conexión") con reintento. Al montar el
cuestionario, rehidratar desde `localStorage` si hay backup pendiente. El endpoint GET
`/:token/responses` ya existe para restaurar desde el servidor lo ya guardado.

---

## 4. Hallazgos altos (verificados a mano o por panel adversarial)

**A1 — `access_token` filtrado a Google Analytics + Microsoft Clarity.** `_document.tsx:14-17` carga
gtag (`G-KT5D58PW0N`) y Clarity (`w7iw3jubtg`) de forma **global**, sin excluir `/participant/...`.
El token de 64 chars va en el path de esa URL, así que GA registra el `page_path` completo y Clarity
graba session-replay de la batería (datos de salud del trabajador) hacia terceros. Refuerzo:
`server.js:20` desactiva CSP a propósito (`contentSecurityPolicy: false`) para permitir estos scripts.
**Fix:** excluir analytics en rutas de participante (montaje condicional por `pathname`).

**A2 / A3 / A4 — Exposición de secretos y PII.** Matices verificados (el auditor sobreestimó
"en repo público" para dos de ellos; corregidos aquí):
- `.claude/settings.json` contiene el password de la BD de prod en claro. **No está commiteado**
  (untracked) **pero tampoco está en `.gitignore`** → un `git add .` lo sube. Riesgo latente alto.
- `fundacionsanmartinmatriz.xlsx` (705 cédulas + nombres + datos de salud) está en el working tree,
  **no commiteado pero no gitignoreado**. Mismo riesgo latente. Ley 1581/2012 aplica.
- `CLAUDE.md` **sí está commiteado** en el repo público y contiene credenciales admin (`admin123`) e
  infra de prod (App ID, host/puerto/usuario de BD).
**Fix:** añadir `.claude/`, `*.xlsx`, `*.pdf`, `*.png`, `cookies.txt` a `.gitignore`; sacar
credenciales de `CLAUDE.md` (dejar solo referencias a env vars); rotar lo expuesto.

**A5 — Login sin rate-limit propio ni lockout.** El único límite es el global de 500 req/15min por
IP (`server.js:24`); `/api/auth/login` no tiene límite dedicado ni bloqueo por cuenta. Fuerza bruta
viable contra `admin123`. **Fix:** `express-rate-limit` estricto en `/login` (p.ej. 5/min por IP+email)
+ backoff por cuenta.

**A6 — `POST /api/responses/` siempre devuelve 400.** El schema Joi exige
`participantId: Joi.string().uuid()` (`responses.js:10`) pero `participants.id` es `increments()`
(serial integer, migración `20241201000004`). Todo request legítimo falla la validación. El endpoint
está muerto (además el schema usa `'stress'`/`max(4)` cuando el resto del código usa `'estres'` y la
escala de estrés es 0-3). **Fix:** cambiar a `Joi.number().integer()` y alinear tipos/escala; o
eliminar el endpoint si el flujo real usa `participant-access`.

**A7 — El motor no valida el rango de `response_value`.** `getItemScore` (`calculate-results.js:373`)
aplica `4 - responseValue` sin acotar; un valor 7 en ítem invertido da `-3`, un negativo entra al
bruto. En estrés, un valor fuera de 0-3 se mapea silenciosamente a `0` ('Nunca'). **Fix:** validar
`0 ≤ response_value ≤ 4` (0-3 estrés) al entrar y rechazar/loguear fuera de rango.

**A8 — Integración resuelve empresa por nombre, sin validar ownership.** `integration.js:88` busca la
empresa por `companyName` (columna no única) y no verifica que pertenezca al evaluador resuelto.
Dos empresas con el mismo nombre → el participante puede caer en el tenant equivocado. **Fix:**
resolver por id/NIT único y validar `created_by`.

**A9 — Reuso de PE completado para segunda orden.** `integration.js:182`: si llega un `externalRef`
nuevo pero ya hay un PE con token válido, se reusa el PE (que puede estar `completed`) y solo se
actualiza metadata. La segunda evaluación **nunca se crea** ni dispara webhook. **Fix:** si el PE
existente está `completed`, crear uno nuevo para el nuevo `externalRef`.

**A10 — `parseResponseValue` invierte siempre los numéricos.** `excel-import-detector.js:300` asume
que todo Excel numérico está en la escala invertida del formato oficial (Siempre=0). Un Excel en
escala BRS directa (Siempre=4) se importa **con todos los resultados al revés**, sin aviso. **Fix:**
detectar/confirmar la escala con el usuario en el preview, o exigir declaración explícita.

**A11 — Documento repetido en Excel revienta la importación.** `evaluations.js:768`: un documento
duplicado (o presente en FA y FB) choca con el UNIQUE `(company_id,email)` y tira 500 en toda la
importación. **Fix:** deduplicar en preview y manejar `23505` con mensaje por fila.

**A12 — `getAtRiskDimensions` muta por referencia.** `report-data-aggregator.js:331` modifica los
conteos de Forma A al agregar B → el informe organizacional publica cifras A+B rotuladas como Forma
A. **Fix:** clonar antes de acumular (`{...conteo}`).

**A13 — Backdoor de super-admin por email.** `auth.js:70`: `SUPER_ADMIN_EMAILS =
['d_talero@yahoo.com']` otorga super-admin por email además del rol. Explotabilidad acotada (el
registro es público pero el email es único, así que un atacante no puede reclamarlo si ya existe la
cuenta), pero es un bypass del sistema de roles y si esa cuenta tiene password débil es acceso
cross-tenant total. **Fix:** gating por rol/flag en BD, no por email hardcodeado.

**A14 — Build artifacts versionados.** `frontend/.next` (incluido `cache/webpack/*.pack.gz`) y
`node_modules` están trackeados pese a estar en `.gitignore` (se agregaron antes de ignorarlos).
Genera diffs ruidosos y conflictos. **Fix:** `git rm -r --cached frontend/.next frontend/node_modules`
y commitear.

**A15 — Sin tests ni entorno de test.** `jest` y `supertest` ya están instalados pero no hay un solo
test; `knexfile.js` no define entorno `test`, así que no hay forma de correr integración sin apuntar
a prod. Ver §7.

---

## 5. Hallazgos medios y bajos (resumen)

**Seguridad (media):** `POST /:token/responses` no valida `questionnaireType` ni contenido → 31
claves basura marcan la batería completa y disparan cálculo+webhook (`participant-access.js:387`) ·
SSRF ciego: `callbackUrl` de integración sin validar host/esquema (`integration.js:159`) · el
`access_token` sigue vivo tras completar y permite sobrescribir respuestas (`participant-access.js:431`) ·
`morgan('combined')` registra el token en logs de runtime (`server.js:45`) · rol tomado del JWT, no
de la BD → cambio de rol no surte efecto hasta 7 días (`auth.js:27`) · `PUT /users/:id` permite
degradar al último admin (`users.js:210`) · `POST /visitor-notify` público reenvía texto arbitrario a
WhatsApp (`server.js:83`) · `xlsx@0.18.5` con prototype-pollution conocida sin filtro de tipo
(`participants.js:9`) · `/health` y 6 endpoints devuelven el mensaje crudo de PostgreSQL.

**Correctitud (media):** `DELETE /users/:id` siempre 500 (`evaluations.evaluator_id` inexistente,
`users.js:288`) · `GET /evaluations/:id` siempre 500 (`participants.evaluation_id` inexistente,
`evaluations.js:143`) · admin no puede editar/activar evaluadores auto-registrados (`users.js:174`) ·
`generate-token` devuelve fecha de expiración falsa (`participants.js:898`) · anti-spam de `/register`
devuelve 201 falso, pierde registros legítimos rápidos (`auth.js:30`) · el redirect a `returnUrl`
**sigue activo** aunque `CLAUDE.md` lo documenta como eliminado (`[token].tsx:118`) · el grupo
ocupacional se infiere de la presencia de Forma B, no del `formType` real (`results.js:59`) ·
respuestas duplicadas para el mismo `questionNumber`: gana la última en silencio · "Matriz de
Priorización" del informe publica columnas con constantes hardcodeadas (`report-data-aggregator.js:492`).

**Performance (media):** `GET /api/participants` hace 2 queries por participante y el frontend pide
`limit=10000` → hasta ~20.001 queries por request (`participants.js:250` + `participants.tsx:111`) ·
reporte con `includeIndividualSummaries`: N+1 secuencial + PDF ilimitado en memoria en un proceso de
512MB (`reports.js:187`) · `GET /results/evaluation/:id` carga todo el JSON de resultados sin
paginación · `import-excel` mantiene la transacción abierta durante todo el bucle CPU-bound
(`evaluations.js:717`).

**Operación / deuda (media):** los routers se cargan en try/catch silencioso → el server arranca
"sano" con módulos faltantes (`server.js:122`) · sin handlers de `unhandledRejection`/`uncaughtException` ·
`next.config.js` ignora errores de TypeScript en el build de prod y no hay ESLint configurado ·
`generate-report.js` (539 líneas) es código muerto que arrastra **puppeteer/Chromium** a cada build ·
`.do/app.yaml` describe un despliegue de 2 servicios que no existe · 75 `fetch` a mano en el frontend
sin cliente HTTP centralizado · el bloque de parse-JSON-de-columna está copiado ~29 veces · mapa de
nombres de dimensiones duplicado backend/frontend y **ya divergió** · ~20 archivos sueltos en la raíz,
algunos escriben sobre la BD de prod.

**Bajas:** enumeración de cuentas en `/register` (409 distinguible) · params no numéricos en `:id` →
500 opaco · `PUT /auth/profile` sin validar longitud contra varchar(255) · `audit_logs` insertado
fuera de la transacción → 500 al usuario aunque la operación principal ya commiteó · `findHeaderRow`
solo escanea 4 filas · código muerto (`determineFormType`, `excelDateToString`) · ~34 líneas de
`console.log` por request en `results.js`.

---

## 6. Plan de ejecución

### Fase 1 — Riesgos de producción (esta semana, ~2-3 días)
Objetivo: parar sangrado de datos y corregir el cálculo con valor legal.

1. **Rotar** la password del admin de producción y las credenciales de BD expuestas. *(30m)* — A4, C3
2. Añadir `.claude/`, `*.xlsx`, `*.pdf`, `*.png`, `cookies.txt` a `.gitignore`; sacar credenciales de
   `CLAUDE.md`. *(1h)* — A2, A3, A4
3. Guarda anti-prod en el seed + password por env. *(1h)* — C3
4. Arreglar `getRiskLevel` (eliminar huecos y el default `riesgo_medio`) + test de cobertura de
   rangos. *(4h)* — C1
5. Definir y aplicar la política de dimensiones incompletas (marcar inválidas). *(1d)* — C2
6. Unificar el manejo de errores del save del participante (backup + toast + rehidratación). *(4h)* — C4
7. Rate-limit dedicado en `/login`. *(3h)* — A5
8. Validar rango de `response_value` en el motor. *(2h)* — A7

**Total Fase 1: ~2.5 días.**

### Fase 2 — Bugs que afectan a usuarios y deuda que frena (1-2 semanas)
9. `git rm --cached` de `.next`/`node_modules`. *(30m)* — A14
10. Arreglar `responses.js` (Joi UUID→serial) o eliminarlo. *(2h)* — A6
11. Integración: resolver empresa por id + validar ownership; crear PE nuevo si el existente está
    completado. *(1d)* — A8, A9
12. Importación Excel: deduplicar documentos + confirmar escala numérica en preview. *(1.5d)* — A10, A11
13. `getAtRiskDimensions` clonar antes de mutar. *(1h)* — A12
14. Endpoints rotos por columnas inexistentes (`DELETE /users/:id`, `GET /evaluations/:id`,
    editar evaluadores). *(4h)* — medias
15. Handlers globales `unhandledRejection`/`uncaughtException` + quitar el token de los logs. *(3h)*
16. Eliminar `generate-report.js` (y puppeteer del build). *(2h)*

**Total Fase 2: ~5-6 días.**

### Fase 3 — Mejoras opcionales (cuando haya aire)
17. Cliente HTTP centralizado en el frontend (los 75 `fetch`). *(2-3d)*
18. Middleware de ownership + helper de errores para matar la duplicación en 22 call sites. *(1-2d)*
19. Activar `strict` en TS y quitar `ignoreBuildErrors`; configurar ESLint + CI. *(1-2d)*
20. Limpieza de la raíz del repo (mover scripts a `scripts/`, borrar imágenes/pdf sueltos). *(3h)*
21. Paginación real con límites en los listados. *(1d)*

---

## 7. Estrategia de testing recomendada (mínima, alto ROI)

Es un producto de un desarrollador; propón solo lo que se va a mantener. Orden:

1. **Golden tests del motor de cálculo** (`calculate-results.js`) — es la razón de ser del producto.
   Runner: **Jest** (ya instalado). Vectores: usa el participante Carlos Ruiz (`participant_id=5`,
   34 dimensiones ya calculadas) como golden master, y recicla los `compare-results*.js` de la raíz
   (contienen casos reales, hoy dependen de la BD de prod — extráeles los vectores a fixtures). Casos
   borde obligatorios: respuestas parciales (C2), valores fuera de rango (A7), ítems duplicados.
2. **Property test de baremos** — ningún score en `[0,100]` debe caer al default; los rangos deben
   cubrir el dominio sin huecos (esto habría atrapado C1 el día 1). Trivial con `fast-check`.
3. **Detector de Excel** — 10 funciones puras + un fixture real (`fundacionsanmartinmatriz.xlsx`).
   Tests de layout con 2-3 formatos.
4. **Un test de integración de ownership** — el que evita el peor bug posible (fuga cross-tenant).
   Añade entorno `test` a `knexfile.js` (hoy no existe — A15) apuntando a una BD local o SQLite;
   patrón: transacción + rollback por test.

**No testear todavía:** PDFs (frágiles, bajo ROI), UI del frontend, blog. Setup total realista:
**1-1.5 días** para dejar Jest corriendo con los golden tests del motor + baremos; el resto,
incremental.

---

## 8. Lo que está bien y NO hay que tocar

Sé explícito aquí — tocar esto sería riesgo sin beneficio:

- **Aislamiento multi-tenant en listados e individuales.** El auditor dedicado no encontró un IDOR
  cross-tenant explotable. `getOwnedCompanyIds()` está aplicado consistentemente. No lo reescribas.
- **JWT.** Usa `process.env.JWT_SECRET` sin fallback hardcodeado (el hallazgo de "secreto débil" fue
  **refutado** al leer el código). Verificación de usuario activo en cada request. Correcto.
- **Índices de BD.** Los hallazgos de "falta índice en `participant_evaluations.participant_id` /
  `companies.created_by`" fueron **refutados**: los índices existen en las migraciones. El pool y los
  JOINs calientes están cubiertos.
- **Integración server-to-server.** Idempotencia por `externalRef` con UNIQUE parcial race-safe,
  timing-safe API key, webhook firmado con HMAC. Diseño sólido (salvo A8/A9, que son ajustes puntuales).
- **Detector de Excel header-aware.** Genuinamente robusto ante layouts no estándar. Solo necesita el
  ajuste de escala (A10) y dedup (A11), no un rediseño.
- **Baremos oficiales transcritos.** Los valores de las Tablas 29-34 están bien; el problema es la
  *función que los consulta* (C1), no los datos.
- **Arquitectura de despliegue single-service** y el sistema FlowLayout del frontend. Funcionan;
  invertir en refactorizarlos no paga.

También hay **9 hallazgos que un agente reportó pero la verificación adversarial refutó** al leer el
código (secreto JWT débil, endpoint `/refresh` inexistente, varios "falta índice", pool sin timeouts,
"tipología de estrés siempre igual"). No están en este informe a propósito: no se sostuvieron.

---

## 9. Notas sobre `CLAUDE.md`

`CLAUDE.md` está **desactualizado** y en un punto es **peligroso**:

- **Documenta credenciales admin e infra de prod** en un repo público (A4) — sacarlas.
- **No documenta** varios módulos que sí existen: `backend/routes/photo-import.js` (710 líneas, OCR
  de hojas de respuesta), `backend/routes/admin.js`, `backend/utils/answer-sheet-ocr.js`,
  `backend/utils/calculate-coping.js`, `backend/utils/generate-report.js` (código muerto), y las
  páginas de blog/profile/admin-clients. También faltan migraciones (`paid`, profile fields,
  `report_text_overrides`).
- **Afirmación falsa detectada:** dice que el redirect a `returnUrl` está *desactivado*, pero el
  código en `[token].tsx:118` **sigue redirigiendo** (hallazgo medio). Actualizar o re-desactivar.
- La afirmación sobre endpoints con columnas viejas de `audit_logs` es parcialmente cierta: se
  confirmó el patrón, pero los endpoints rotos hoy son por **otras** columnas inexistentes
  (`evaluations.evaluator_id` en `DELETE /users/:id`, `participants.evaluation_id` en
  `GET /evaluations/:id`).

---

*Metodología: 17 auditores en paralelo sobre el código real + verificación adversarial (3
refutadores con lentes distintas por hallazgo crítico/alto). La corrida se cortó por límite de gasto
antes de la síntesis automática, así que las críticas y la mayoría de las altas fueron **releídas y
verificadas a mano** contra el código (incluyendo un script que confirmó los 23 puntajes mal
clasificados de C1). Los esfuerzos son estimaciones para quien ya conoce el código.*

---

# Estado de implementación (2026-07-20)

## Altas pendientes — TODAS aplicadas

- **A1** — Google Analytics + Clarity ya no se cargan en rutas `/participant/...` (movidos de `_document.tsx` a un cargador condicional por ruta en `_app.tsx`). El `access_token` deja de filtrarse a terceros.
- **A6** — `responses.js`: el schema Joi acepta `participantId` entero (antes exigía UUID → siempre 400).
- **A8** — `integration.js`: la empresa se resuelve filtrando por `created_by` (ownership); un nombre repetido ya no coloca al participante en el tenant de otro evaluador.
- **A9** — `integration.js`: si el PE previo está `completed`, una nueva orden crea una **re-evaluación dedicada** con PE y token nuevos (antes reusaba el PE terminado y no disparaba webhook).
- **A10** — `parseResponseValue` acepta `numericScale` explícito (`'inverted'` default = formato oficial; `'direct'` para Excels en escala BRS). El import lo lee de `req.body.numericScale`. 5 tests. **Falta (menor):** el toggle en el modal de importación del frontend — hoy la API lo soporta pero la UI siempre manda el default.
- **A11** — el importador de Excel **dedup**a documentos repetidos (misma persona en dos filas, o en FA y FB) antes de insertar; ya no revienta con 500 y reporta las filas omitidas.
- **A13** — el super-admin por email ya no está hardcodeado: se lee de `BRS_SUPER_ADMIN_EMAILS`. **Requiere acción:** setear esa env var en DigitalOcean con `d_talero@yahoo.com` si esa cuenta debe conservar super-admin; sin la env var, solo `role='admin'` concede super-admin.

## Ya aplicado y verificado

**Seguridad / higiene:** `.gitignore` (secretos + PII), credenciales fuera de `CLAUDE.md`, guarda
anti-prod + password por env en el seed, rate-limit de login, fix de pérdida silenciosa de respuestas
del participante, `getAtRiskDimensions` sin mutación por referencia, build artifacts fuera de git.

**Motor de cálculo (verificado contra BRS.pdf, Manual General oficial):**
- **C1 corregido en dos sitios** — el manual (Paso 3) exige redondear el puntaje transformado a **1
  decimal**; el código redondeaba a 2, generando valores en los huecos de 0.1 de los baremos que caían
  al fallback `riesgo_medio`. Corregido en `transformScore` y en el cálculo inline de estrés.
- **Verificado vs manual:** baremos Forma A = Tabla 29 (19/19 exactos); factores de transformación =
  Tabla 25 (19/19 Forma A, 16/16 Forma B); property test: cero huecos en TODAS las tablas (A/B,
  dominios, totales, extralaboral, estrés) a 1 decimal.
- **A7 aplicado** — validación de rango de `response_value` (0-4 intra/extra, 0-3 estrés) en los tres
  cuestionarios: un valor fuera de rango se trata como no respondido, no se inyecta al puntaje bruto.
- **32 tests Jest** en `backend/tests/` bloquean todo lo anterior.

## C2 — regla de ítems mínimos: IMPLEMENTADA (motor + backend)

Decisión del usuario: mostrar **"No calculable"**. Reglas del manual (Paso 2) implementadas en
`calculate-results.js` y cubiertas por tests:

1. **Intralaboral:** *liderazgo, relaciones sociales, relación con colaboradores y demandas
   ambientales* admiten 1 ítem faltante; el resto, todos. **Extralaboral:** solo *características de
   la vivienda* admite 1 faltante. **Estrés:** exige los 31 ítems.
2. Dimensión bajo el mínimo → `no_calculable` (puntajes null). Dominio con una dimensión inválida →
   `no_calculable`. Total con un dominio inválido → `no_calculable`.
3. **Secciones de filtro** (demandas emocionales sin atención a clientes; relación con colaboradores
   sin ser jefe) → **puntaje bruto 0 automático, válidas** (no inválidas), con su max incluido en el
   denominador del dominio (verificado: Tabla 26).
4. **Display:** `pdf-charts.js`, `reports.js` y `results.js` ya muestran "No Calculable" en gris y
   guardan los null (barras vacías, "N/C"). El agregador organizacional excluye `no_calculable` de la
   distribución de riesgo de forma segura. Frontend: en progreso (~8 archivos de resultados).

**Verificación COMPLETA del motor contra el manual — todo coincide exacto, cero discrepancias:**
- Baremos: Tabla 29 (Forma A 19/19) + property test sin huecos en TODAS las tablas (A/B, dominios, totales, extralaboral, estrés).
- Factores de transformación: Tabla 25 (19 Forma A + 16 Forma B).
- Factores de dominio: Tabla 26 (8/8).
- Ítems invertidos: Tabla 21 (73 A) + Tabla 22 (68 B) + Tabla 11 (23 extralaboral).
- Mapeo ítem→dimensión: Tabla 23 (19 Forma A + 16 Forma B) + Tabla 12 (7 extralaboral).

No queda nada pendiente de la revisión del cálculo. Los únicos defectos encontrados fueron C1
(redondeo) y C2 (ítems mínimos), ambos corregidos y con tests.

## ⚠️ Recalcular resultados existentes tras el deploy

Los fixes de C1/C2 aplican a **nuevos** cálculos. Los resultados ya guardados en producción se
calcularon con el motor viejo (2 decimales, sin regla de ítems mínimos). Para que los participantes
existentes reflejen las correcciones hay que **recalcular** (`POST /api/results/calculate/:peId` por
participante, o un script masivo). Sin esto, los reportes viejos siguen mostrando la clasificación
anterior.
