# BRS - Batería de Riesgo Psicosocial

## RESUMEN DEL PROYECTO

Plataforma SaaS multi-empresa para la evaluación de factores de riesgo psicosocial basada en la **Batería oficial del Ministerio de la Protección Social de Colombia** (Resolución 2646 de 2008). Los psicólogos se auto-registran, crean sus propias empresas y gestionan múltiples baterías de forma independiente. Desplegada en producción en DigitalOcean App Platform.

**URL Producción**: https://bateriariesgopsicosocial.com (alias: https://brs-abaxh.ondigitalocean.app)
**Repositorio**: https://github.com/dtalero78/BRS

## ARQUITECTURA

```
Frontend (Next.js + TypeScript + Tailwind CSS)
    ↓  (exportado estático, servido por Express)
Backend (Node.js/Express + Knex.js)
    ↓
PostgreSQL (DigitalOcean Managed Database, SSL requerido)
```

**Modelo de despliegue**: Single-service en DigitalOcean App Platform. El backend Express sirve el frontend como archivos estáticos desde `frontend/out/`. No hay servicio separado de frontend en producción.

## INFRAESTRUCTURA DE PRODUCCIÓN

- **DO App ID**: `420e1df4-744a-4442-a9b9-87c8b8603eb7`
- **DB Host**: `brs-do-user-19197755-0.l.db.ondigitalocean.com`
- **DB Port**: `25060` | **DB Name**: `defaultdb` | **DB User**: `doadmin`
- **DB Password**: (ver variable de entorno en DigitalOcean) (SSL requerido, `rejectUnauthorized: false`)
- **doctl**: `~/bin/doctl`

### Usuarios de Prueba
| Rol | Email | Password |
|-----|-------|----------|
| Admin | admin@brsdigital.com | (en gestor de contraseñas) |
| Evaluador | evaluator@test.com | (en gestor de contraseñas) |
| Participante | carlos.ruiz@techcorp.com | (acceso por token) |

> ⚠️ Las contraseñas NO se documentan aquí (repo público). Guárdalas en un gestor
> de contraseñas. Este archivo antes exponía `admin123`/`evaluator123`: **rótalas**.

### Datos de Prueba
- Participante Carlos Ruiz: `participant_id=5`, `participant_evaluation_id=5`
- Tiene 4 respuestas completadas: estres, extralaboral, intralaboral_a, ficha_datos
- Tiene resultados calculados: 34 dimensiones/dominios

## ESTRUCTURA DEL PROYECTO

```
BRS/
├── .do/app.yaml              # Config DigitalOcean (no se usa, deploy es single-service)
├── backend/
│   ├── server.js             # Express server principal (sirve frontend estático)
│   ├── package.json          # `start` chain: `knex migrate:latest && node server.js`
│   ├── knexfile.js           # Config Knex (SSL DENTRO de connection en production)
│   ├── config/
│   │   └── database.js       # Conexión PostgreSQL con Knex.js (SSL)
│   ├── middleware/
│   │   ├── auth.js           # JWT verification, role-based auth, getOwnedCompanyIds()
│   │   └── api-key.js        # Auth por X-Api-Key (integración server-to-server, timing-safe)
│   ├── migrations/           # Migraciones Knex (corren auto en cada deploy)
│   │   ├── 20241201*.js      # Esquema inicial (companies, users, evaluations, …)
│   │   ├── 20250903*.js      # access_token + ficha_datos questionnaire_type
│   │   ├── 20260420000001_scope_participants_email_per_company.js
│   │   ├── 20260526000001_add_integration_metadata_to_participant_evaluations.js
│   │   ├── 20260730000001_add_face_verification.js  # foto de referencia + bitácora de intentos
│   │   ├── 20260731000001_add_questionnaire_type_to_face_verifications.js  # verificación por cuestionario
│   │   ├── 20260731000002_allow_coping_questionnaire_type.js  # deriva: coping faltaba en las CHECK
│   │   ├── 20260902000001_add_include_coping_to_evaluations.js  # Brief COPE opcional por evaluación
│   │   └── 20260903000001_add_wompi_payments.js  # payments + payment_items + PE.paid_at (pago por prueba)
│   ├── routes/
│   │   ├── auth.js           # Login, register (self-service evaluador), refresh, logout
│   │   ├── companies.js      # CRUD empresas (admin + evaluador con ownership)
│   │   ├── users.js          # CRUD usuarios (admin)
│   │   ├── evaluations.js    # Gestión de evaluaciones + import/preview Excel
│   │   ├── participants.js   # Gestión de participantes (filtrado por ownership)
│   │   ├── participant-access.js # Acceso público por token
│   │   ├── integration.js    # Provisión server-to-server de participantes (BSL-PLATAFORMA2)
│   │   ├── questionnaires.js # Servir cuestionarios
│   │   ├── responses.js      # Guardar/recuperar respuestas
│   │   ├── results.js        # Calcular y consultar resultados (filtrado por ownership)
│   │   ├── reports.js        # Generación de PDF (PDFKit)
│   │   ├── payments.js       # Pago por prueba con Wompi (pendientes, checkout, verify, webhook)
│   │   └── system.js         # Config, health, baremos
│   ├── services/
│   │   ├── webhook-emitter.js # Webhook evaluation.completed (HMAC-SHA256) a sistemas externos
│   │   └── wompi.js           # Firma de integridad, checksum de eventos, consulta y aplicación de transacciones
│   └── utils/
│       ├── rekognition.js            # Verificación facial AWS (DetectFaces + CompareFaces)
│       ├── calculate-results.js      # Motor de cálculo BRS oficial
│       ├── baremos-completos.js      # Baremos Tablas 29-34 del Ministerio
│       ├── excel-import-detector.js  # Detector header-aware + parser de respuestas Excel
│       ├── pdf-charts.js             # Gráficas PDF: pie, bar, grouped bar, tablas
│       ├── report-templates.js       # Textos estáticos, mapeos dimensiones, intervenciones
│       └── report-data-aggregator.js # Agregación demográfica y resultados por forma A/B
├── frontend/
│   ├── config/
│   │   └── api.ts            # API_URL config (relativa en prod, localhost en dev)
│   ├── components/
│   │   ├── FaceCapture.tsx    # Captura de selfie (getUserMedia + canvas) para verificación facial
│   │   ├── FlowLayout.tsx     # Layout Typeform-style: header + content (reemplaza Layout para la mayoría de páginas)
│   │   ├── FlowOption.tsx     # Card-option con letra, icono, badge, arrow (para hubs)
│   │   ├── FlowQuestion.tsx   # Título de pregunta estilo Typeform
│   │   ├── FlowStats.tsx      # Barra de estadísticas compactas
│   │   ├── Layout.tsx         # Sidebar + topbar legacy (solo participantes y páginas específicas)
│   │   ├── QuestionnaireForm.tsx # Formulario progresivo de cuestionarios
│   │   ├── ReportGenerator.tsx   # UI para generar reportes PDF
│   │   ├── ResultsDimensionCard.tsx
│   │   ├── ResultsDomainsChart.tsx
│   │   ├── ResultsInterpretation.tsx
│   │   └── RiskSummaryChart.tsx
│   ├── hooks/
│   │   └── useFlowKeyboard.ts # Hook para navegación por teclado (A-Z) en hubs
│   ├── public/
│   │   └── fonts/
│   │       └── ibrand.otf     # Font personalizado para branding
│   ├── pages/
│   │   ├── index.tsx                    # Landing page (auto-redirect si logueado)
│   │   ├── _app.tsx                     # App wrapper
│   │   ├── auth/
│   │   │   ├── login.tsx                # Login (con link a registro)
│   │   │   └── register.tsx             # Auto-registro de evaluadores (sin empresa)
│   │   ├── admin/
│   │   │   ├── dashboard.tsx            # Dashboard admin (FlowLayout hub)
│   │   │   ├── companies.tsx            # CRUD empresas (FlowLayout full)
│   │   │   └── users.tsx                # CRUD usuarios (FlowLayout full)
│   │   ├── evaluator/
│   │   │   ├── dashboard.tsx            # Dashboard evaluador (FlowLayout hub)
│   │   │   ├── companies.tsx            # CRUD empresas del evaluador (FlowLayout full)
│   │   │   ├── evaluations.tsx          # Gestión evaluaciones + selector empresa
│   │   │   ├── participants.tsx         # Gestión participantes (FlowLayout full)
│   │   │   ├── results.tsx              # Lista de resultados
│   │   │   ├── results/[participantId].tsx # Resultados detallados por participante
│   │   │   ├── results-dashboard/       # Dashboard visual de resultados
│   │   │   ├── organizational-dashboard/ # Dashboard organizacional
│   │   │   ├── payments.tsx             # Pruebas pendientes de pago + checkout Wompi + historial
│   │   │   ├── payments/result.tsx      # Retorno de Wompi: verifica la transacción y muestra el estado
│   │   │   └── reports.tsx              # Generador de reportes PDF
│   │   └── participant/
│   │       ├── questionnaires.tsx       # Lista de cuestionarios
│   │       ├── questionnaires/[id].tsx  # Completar cuestionario
│   │       └── evaluation/[token].tsx   # Acceso público por token
│   └── out/                             # Build estático exportado
└── database/
    └── schema.sql                       # Schema inicial
```

## BASE DE DATOS

```sql
-- Gestión de usuarios y empresas
users (id, email, password_hash, role, company_id [nullable], active, created_at, updated_at)
companies (id, name, nit, contact_email, contact_phone, active, created_by [FK→users], created_at, updated_at)
participants (id, company_id, email, demographic_data, active, created_at, updated_at)

-- Sistema de evaluaciones
evaluations (id, company_id, name, description, start_date, end_date, status, created_by, created_at)
participant_evaluations (id, evaluation_id, participant_id, status, assigned_at, completed_at, updated_at)

-- Respuestas y resultados
responses (id, participant_evaluation_id, questionnaire_type, responses, completed_at, created_at)
results (id, participant_evaluation_id, questionnaire_type, results, calculated_at, created_at)

-- Pagos por prueba (Wompi)
payments (id, user_id, reference [unique], amount_in_cents, currency, unit_price_in_cents, quantity, status, wompi_transaction_id, payment_method, wompi_payload, approved_at, created_at, updated_at)
payment_items (id, payment_id, participant_evaluation_id)
-- participant_evaluations también tiene paid_at + payment_id (prueba liberada)
-- evaluations tiene paid/paid_at/paid_by (interruptor manual del admin para toda la evaluación)

-- Configuración del sistema
system_configs (id, config_key, config_value, description, updated_at)
audit_logs (id, user_id, action, table_name, record_id, old_values, new_values, created_at)
```

### Modelo SaaS Multi-Empresa
- `companies.created_by` vincula cada empresa al evaluador que la creó (ownership)
- `users.company_id` es nullable — evaluadores nuevos se registran sin empresa
- Filtrado por ownership: `getOwnedCompanyIds(userId)` → `whereIn('company_id', ownedIds)`
- JWT payload: `{userId, role}` — sin companyId fijo
- Admin ve todo; evaluador solo ve sus empresas y datos asociados
- **Constraint `participants.email`**: único por `(company_id, email)`, no global (migración `20260420000001`). Esto permite que dos empresas importen el mismo documento de identidad sin colisionar.

### Migraciones Knex
- Corren automáticamente al arrancar el container: `npm start` = `knex migrate:latest && node server.js`
- Idempotentes: knex registra cada migración aplicada en `knex_migrations`, no las re-ejecuta
- Si una migración falla, el container no arranca → DigitalOcean hace rollback automático al deploy anterior
- Para crear una nueva: archivo en `backend/migrations/<timestamp>_<nombre>.js` con `exports.up` y `exports.down`

**Formato de `results.results`** (JSONB array):
```json
[
  {"dimension": "sintomas_fisiologicos", "rawScore": 6, "transformedScore": 25, "percentile": 25, "riskLevel": "sin_riesgo"},
  {"dimension": "demandas_del_trabajo_total", "rawScore": null, "transformedScore": 45.2, "percentile": null, "riskLevel": "riesgo_alto"}
]
```
Dimensiones con sufijo `_total` son totales de dominio.

**Formato de `responses.responses`** (JSONB array):
```json
[{"questionNumber": 1, "responseValue": 3}, {"questionNumber": 2, "responseValue": 1}]
```

## API REST - ENDPOINTS

### Autenticación (`/api/auth`)
- `POST /login` - JWT login (devuelve token + user data + lista de empresas)
- `POST /register` - Auto-registro evaluador (solo email, password, nombre — sin empresa)
- `POST /refresh` - Renovar token
- `POST /logout` - Cerrar sesión

### Empresas (`/api/companies`)
- `GET /mine` - Empresas del evaluador (ownership via `created_by`)
- `POST /` - Crear empresa (admin o evaluador, set `created_by = userId`)
- `PUT /:id` - Editar empresa (admin: cualquiera, evaluador: solo propias)
- `DELETE /:id` - Eliminar empresa (admin: cualquiera, evaluador: solo propias)
- `GET /` - Listar todas (solo admin)

### Usuarios (`/api/users`) - Solo admin
- `GET /` | `POST /` | `PUT /:id` | `DELETE /:id`

### Evaluaciones (`/api/evaluations`)
- `GET /` - Listar (filtrado por ownership para evaluadores)
- `POST /` - Crear (requiere `companyId` en body, evaluador elige empresa; `includeCoping` opcional, default `true`)
- `PUT /:id` (acepta `includeCoping`) | `POST /:id/assign`
- `GET /:id/consent-text` | `PUT /:id/consent-text` - Texto del consentimiento informado por evaluación
- `POST /:id/preview-excel` - Analiza el Excel y devuelve layout detectado + muestra de filas, sin persistir nada (multipart `file`)
- `POST /:id/import-excel` - Crea participantes + respuestas + resultados desde Excel (multipart `file`, máx 10MB)

### Participantes (`/api/participants`)
- `GET /` - Listar (filtrado por ownership)
- `POST /` | `PUT /:id` | `GET /evaluation/:evalId`
- `DELETE /:id` - Eliminar (admin: cualquiera, evaluador: solo de empresas propias). Cascada: borra responses + results + participant_evaluations.
- `GET /face-verification-status` - Probe: ¿esta instancia tiene verificación facial? (va ANTES de `/:id`)
- `GET /:id/face` - Estado del enrolamiento + últimos 10 intentos
- `POST /:id/reset-face` - Borra la foto de referencia (válvula de escape del modo bloqueante)

### Cuestionarios (`/api/questionnaires`)
- `GET /` - Listar tipos | `GET /:type` - Obtener (forma_a, forma_b, extralaboral, estres)

### Respuestas (`/api/responses`)
- `POST /` | `GET /evaluation/:evalId/participant/:partId` | `PUT /:id`

### Resultados (`/api/results`)
- `POST /calculate/:participantEvaluationId` - Calcula y guarda resultados
- `GET /participant/:participantEvaluationId` - Resultados por participante
- `GET /evaluation/:evalId` - Resultados por evaluación

### Reportes (`/api/reports`)
- `POST /individual` - PDF individual (`{participantEvaluationId}`)
- `POST /organizational` - PDF organizacional (`{evaluationId}`)

### Acceso Participante (`/api/participant-access`)
- `POST /lookup` - **Puerta general**: `{documentNumber}` → lista de tokens de esa persona. Público, con límite de intentos fallidos.
- `POST /token/validate` - Validar token de acceso (devuelve `company: {name, logoUrl}` para la co-marca)
- `GET /token/:token/questionnaires` - Cuestionarios disponibles
- `POST /token/:token/responses` - Guardar respuestas
- `GET /:token/consent` - Texto del consentimiento + si ya aceptó/rechazó
- `POST /:token/consent` - Registra la decisión (`{accepted: boolean}`)
- `GET /:token/face-status` - ¿Esta instancia exige verificación facial? ¿ya está enrolado/verificado?
- `POST /:token/face` - Enrola (1er ingreso) o verifica la selfie. Rate limit por token.

### Pagos (`/api/payments`) - Evaluador
- `GET /config` - ¿Está activo el cobro? precio por prueba, ambiente (sandbox/producción)
- `GET /pending` - Pruebas sin pagar de sus empresas (agrupables por evaluación) + totales
- `POST /checkout` - `{participantEvaluationIds}` → crea la orden y devuelve `checkoutUrl` de Wompi con el monto firmado
- `POST /verify` - `{transactionId}` (tras el redirect) o `{reference}` → consulta a Wompi y aplica el estado
- `GET /` - Historial de órdenes | `GET /:reference` - Detalle con las pruebas incluidas
- `POST /wompi/events` - **Webhook público** de Wompi (verifica el checksum con `WOMPI_EVENTS_SECRET`)

### Integración server-to-server (`/api/integration`) - Auth por `X-Api-Key`
- `POST /participant` - Provisiona participant + participant_evaluation y devuelve token de acceso + URL. Idempotente por `externalRef`.

### Sistema (`/api/system`)
- `GET /health` | `POST /load-questionnaires` | `POST /load-baremos` | `GET /baremos-summary`

## MOTOR DE CÁLCULO BRS

**Archivo**: `backend/utils/calculate-results.js`
**Firma**: `calculateResults(questionnaireType, responses, options)` donde `responses` es `[{question_number, response_value}]` y `options` puede incluir `{ occupationalGroup: 'jefes' | 'auxiliares' }`

- **Fórmula oficial**: `(Puntaje obtenido / Factor de transformación) * 100`
- **Escala Likert intralaboral/extralaboral**: Siempre (4), Casi siempre (3), Algunas veces (2), Casi nunca (1), Nunca (0)
- **Escala Likert estrés**: Siempre (3), Casi siempre (2), A veces (1), Nunca (0) → con puntuación variable por ítem
- **Ítems invertidos**: Tablas 21, 22, 11 del documento oficial. Ítems protectores usan `score = 4 - responseValue`
- **5 niveles de riesgo**: sin_riesgo, riesgo_bajo, riesgo_medio, riesgo_alto, riesgo_muy_alto
- Retorna array de objetos: `{dimension, rawScore, transformedScore, percentile, riskLevel}`
- Incluye totales de dominio (`*_total`) y puntaje total (`puntaje_total_*`)

### Dimensiones implementadas (Tabla 23):
- **Forma A Intralaboral**: 19 dimensiones + 4 dominios + 1 total general (items NO secuenciales por dimensión)
- **Forma B Intralaboral**: 16 dimensiones + 4 dominios + 1 total general
- **Extralaboral**: 7 dimensiones + 1 total (con baremos duales: Tabla 17 jefes / Tabla 18 auxiliares)
- **Estrés**: Solo puntaje total con metodología de promedios ponderados (×4, ×3, ×2, ×1) y factor 61.16

### Baremos (`backend/utils/baremos-completos.js`)
- Intralaboral: Tablas 29-33 del documento oficial (verificados correctos)
- Extralaboral: Tabla 17 (jefes/profesionales) y Tabla 18 (auxiliares/operarios) - baremos duales
- Estrés: Tabla 6 - baremos duales por grupo ocupacional (solo puntaje total)
- Total general: Tabla 34 (intralaboral + extralaboral combinado)

## IMPORTACIÓN MASIVA POR EXCEL

**Módulo**: `backend/utils/excel-import-detector.js`
**Endpoints**: `POST /api/evaluations/:id/preview-excel` y `POST /api/evaluations/:id/import-excel`
**UI**: Modal de 3 pasos en `frontend/pages/evaluator/evaluations.tsx` (select → preview → result)

### Detección por header (no por posición fija)
El detector tolera layouts no estándar de cualquier empresa:
- `findHeaderRow(data)` — escanea las primeras 3 filas y elige la que más matches tiene con keywords conocidos (documento, nombre, sexo, cargo, etc.)
- `detectSectionBanners(data, headerRow)` — detecta filas-bandera (`SOCIODEMOGRÁFICO`, `INTRALABORAL`, etc.) que dividen secciones (formato fundacionsanmartin)
- `detectLayout(headers, banners)` — 3 pasadas:
  1. Asigna campos socio cuyo header tiene prefijo de pregunta numerada (`13. ¿Cuál es el nombre del cargo?`)
  2. Asigna campos socio restantes con cualquier match (metadata como `PUESTO DE TRABAJO`)
  3. Asigna items de cuestionario por número embebido (`..114. Mi trabajo me exige…`) y los clasifica por sección via banners o keywords del header
- Salta columnas filtro (no son items): `Soy jefe de otras personas`, `Las siguientes preguntas relacionadas con la atención a clientes y usuarios`, `Si su respuesta fue SI por favor responda` (sin item embebido)

### Parser de respuestas
`parseResponseValue(val, scale)` acepta dos formatos:
- **Numérico** 0-4 (intra/extra) o 0-3 (estrés): asume escala invertida del Excel oficial (Siempre=0..Nunca=4) → convierte a BRS (Siempre=4..Nunca=0)
- **Texto** literal: `"Siempre"`, `"Casi siempre"`, `"Algunas veces"`, `"Casi nunca"`, `"Nunca"` → mapea directamente a la escala BRS
Los valores no parseables (textos sueltos, vacíos) se marcan como inválidos en el preview pero no rompen la importación.

### Generación del email sintético
Como los Excel no traen email, el importador minta `cc_<documento>@temp.com` por participante. El constraint único es `(company_id, email)` (no global), así que múltiples empresas pueden importar el mismo documento sin colisionar. Lookup dual reconoce el formato legacy con sufijo `_c<companyId>` (workaround temporal previo a la migración).

### Layout esperado vs detectado
| Forma | Items intralaboral | Items extralaboral | Items estrés |
|---|---|---|---|
| FA (jefes/profesionales) | 123 | 31 | 31 |
| FB (auxiliares/operarios) | 97 | 31 | 31 |

El preview muestra cuántos items detectó vs los esperados, columnas filtro, items faltantes y muestra de los primeros 5 participantes con conteo de respuestas válidas.

## INTEGRACIÓN SERVER-TO-SERVER (BSL-PLATAFORMA2)

Permite que un sistema externo (ej. BSL-PLATAFORMA2 / Platzi) provisione participantes en BRS y reciba notificación cuando completan la batería. Sin intervención manual del evaluador.

**Auth**: header `X-Api-Key` validado (timing-safe) contra `BRS_INTEGRATION_API_KEY` en `middleware/api-key.js`. Si la env var no está configurada, el endpoint responde 503 (fail-closed).

### Flujo de provisión — `POST /api/integration/participant`
Body: `{ externalRef, documentNumber, firstName, lastName, formType ('A'|'B'), email?, phone?, tenantId?, evaluatorEmail?, companyName?, callbackUrl?, returnUrl? }`. El evaluador y la empresa deben existir (no se auto-crean); se resuelven del body o de `BRS_INTEGRATION_DEFAULT_EVALUATOR` / `BRS_INTEGRATION_DEFAULT_COMPANY`.

1. **Idempotencia por `externalRef`**: si ya hay un PE con ese `externalRef` (columna `integration_metadata`), lo devuelve sin crear otro. Reintentos seguros.
2. Auto-crea una evaluación contenedora `"<Empresa> - Integración BSL"` por empresa (no editar manualmente).
3. Upsert de participant por `(company_id, email)`. Si no viene email, minta `cc_<documento>@temp.com` (mismo patrón que el importador de Excel).
4. PE con `access_token` de 64 chars y TTL de 90 días. Si ya existe un PE para `(evaluation_id, participant_id)`: **reusa** el token si sigue válido (regenerar dejaría la orden previa apuntando a 404); solo regenera si expiró.
5. Race-safe: la UNIQUE parcial `uniq_pe_external_ref` sobre `integration_metadata->>'externalRef'` previene PEs duplicados en POSTs concurrentes; la violación se maneja re-queryando al ganador.

Devuelve `{ token, url, participantId, participantEvaluationId, evaluationId, expiresAt, status, isNew }`. La `url` es `<BRS_PUBLIC_URL>/participant/evaluation/<token>`.

### Webhook de finalización (`services/webhook-emitter.js`)
Cuando el participante completa **toda** la batería, `participant-access.js` llama (sin await, fire-and-forget) a `notifyEvaluationCompleted(peId)`:
- No-op si el PE no tiene `integration_metadata.callbackUrl` (flujos no-integration son silenciosos).
- POST a `callbackUrl` con payload `evaluation.completed` (`externalRef`, `tenantId`, IDs, `status`, `completedAt`).
- Firma `X-Brs-Signature` = HMAC-SHA256(`BRS_WEBHOOK_SECRET`, body). Header `X-Brs-Event: evaluation.completed`.
- Timeout 8s, 1 reintento con backoff de 2s.

### `integration_metadata` (JSONB en `participant_evaluations`)
`{ source, externalRef, tenantId, callbackUrl, returnUrl, createdAt }`. Migración `20260526000001`. Índice GIN + UNIQUE parcial sobre `externalRef`.

### Redirect de retorno — DESACTIVADO
El `returnUrl` se sigue guardando y exponiendo en el API, pero el frontend **ya no redirige** al participante a la app externa al terminar (se quitó el `window.location.href` de `participant/evaluation/[token].tsx`). Ahora todos los participantes se quedan en la pantalla de éxito de BRS. El webhook sí sigue notificando a BSL.

### Env vars de integración
`BRS_INTEGRATION_API_KEY` (requerida), `BRS_WEBHOOK_SECRET` (requerida para webhooks), `BRS_PUBLIC_URL` (base de la URL del token), `BRS_INTEGRATION_DEFAULT_EVALUATOR`, `BRS_INTEGRATION_DEFAULT_COMPANY` (fallbacks).

## PAGO POR PRUEBA CON WOMPI

El evaluador paga por su cuenta las pruebas que aplicó y con eso se liberan los informes. Antes el único mecanismo era que el admin marcara `evaluations.paid` a mano desde `/evaluator/admin-clients`; ese interruptor **sigue existiendo** como cortesía/convenio y libera la evaluación completa aunque ninguna prueba tenga pago.

### La unidad de cobro es la prueba, no la evaluación
Una "prueba" es un `participant_evaluation` (una persona en una evaluación). El total del checkout lo fija **siempre el backend** a partir de las pruebas seleccionadas: el frontend nunca manda un monto ni un precio.

**Tarifa (dos tramos).** $5.000 por prueba, y $3.500 cuando la orden **supera** 250 pruebas. El tramo aplica a **toda la orden**, no solo a las que exceden el umbral. Se configura con `BRS_TEST_PRICE_COP` / `BRS_TEST_PRICE_BULK_COP` / `BRS_TEST_BULK_MIN_QTY`, y `system_configs` (`wompi_unit_price_cop`, `wompi_bulk_price_cop`, `wompi_bulk_min_qty`) manda sobre las env vars para cambiar la tarifa sin redeploy. Sin precio base el módulo queda desactivado; sin precio de volumen se cobra el base siempre (comportamiento previo).

Un `bulkPriceCop >= unitPriceCop` se **ignora** (queda en 0): un "descuento" que no baja el precio es un error de configuración, y aplicarlo le cobraría de más al evaluador justo por comprar más.

> ⚠️ **El umbral tiene un salto, y es deliberado.** Como el precio bajo aplica a toda la orden, pagar 251 pruebas ($878.500) cuesta **menos** que pagar 250 ($1.250.000). Por eso la UI avisa cuando faltan pocas para cruzarlo ("agrega N y pagas $X menos"): un descuento que solo encuentra quien tropieza con él deja a dos evaluadores con la misma cantidad pagando distinto. El umbral se cuenta **por orden de checkout**, no acumulado: el evaluador decide cuándo juntar volumen.

La orden guarda en `payments.unit_price_in_cents` el precio que efectivamente se aplicó, así que el histórico queda auditable aunque la tarifa cambie después.

### Qué se bloquea sin pago (con `BRAND_REQUIRE_PAID_EVALUATION` activo)
- **Informe individual** (`POST /reports/individual`): `403 payment_required` si la prueba no tiene `paid_at` y la evaluación no está `paid`.
- **Informe organizacional** (`POST /reports/organizational`): `403` mientras exista alguna prueba **con resultados** sin pagar. Las pruebas sin resultados no cuentan: no aportan nada al informe.
- **Exportación CSV** de participantes: `evaluationPaid` por fila ahora significa "pagada por prueba **o** evaluación liberada por el admin".
- Responder la batería **nunca** se bloquea: el participante no es quien paga, y la campaña no puede depender de que el evaluador pague antes.
- Super-admin y las instancias con `BRAND_REQUIRE_PAID_EVALUATION=false` (licenciatarios) pasan siempre; en esas el menú "Pagos" ni se muestra (`paymentsEnabled` en el dashboard).

### Flujo
1. `/evaluator/payments` lista las pruebas sin pagar agrupadas por evaluación. Por defecto quedan marcadas las **completadas** (son las que bloquean) con filtro "Solo completadas"; se pueden agregar las demás para pagar por adelantado.
2. `POST /checkout` valida que **todas** las pruebas sean del usuario y sigan sin pagar (si alguna no, `409 ITEMS_NOT_PAYABLE` y se recarga la lista: cobrar de menos en silencio dejaría al evaluador creyendo que pagó algo que sigue bloqueado). Crea la orden `payments` con referencia `BRS-<userId>-<ts36>-<hex>` **antes** de redirigir: el webhook la busca por esa referencia.
3. Redirige al Web Checkout (`https://checkout.wompi.co/p/`) con `amount-in-cents`, `reference`, `signature:integrity` = SHA256(`ref+monto+moneda+WOMPI_INTEGRITY_SECRET`) y `redirect-url` = `<BRS_PUBLIC_URL>/evaluator/payments/result/`. Sin la firma cualquiera editaría el monto en la URL.
4. Dos caminos confirman, y ambos terminan en `applyTransaction()` (idempotente):
   - **Webhook** `POST /api/payments/wompi/events`: verifica el checksum (SHA256 de los `signature.properties` + `timestamp` + `WOMPI_EVENTS_SECRET`, comparación en tiempo constante). Firma inválida → `401` (Wompi **no** reintenta); error de DB → `500` (Wompi reintenta a los 30 min, 3 h y 24 h).
   - **Verificación post-redirect**: Wompi vuelve con `?id=<transacción>`; `POST /verify` consulta esa transacción **directamente a Wompi** (`GET /v1/transactions/:id`) y la aplica. Nunca se confía en lo que trae el navegador. Es la red cuando el webhook aún no llegó o no está configurado. La página reintenta 6 veces cada 5 s (PSE tarda) y deja un botón manual.
5. `APPROVED` con monto y moneda iguales a la orden → `paid_at` + `payment_id` en cada prueba de `payment_items`. Si el monto **no** cuadra, la orden queda en `error` con el payload guardado y **no** libera: es el caso de un checkout manipulado que Wompi igual cobró.
6. Una orden `approved` no retrocede (los eventos pueden llegar fuera de orden). Una orden `pending` abandonada se queda así; la misma prueba puede aparecer en varias órdenes pendientes y se libera con la primera que se apruebe.

### El Web Checkout rechaza un `redirect-url` a localhost

Probar el checkout desde `localhost` **no funciona**, y el modo de falla no dice por qué: el navegador aterriza en un **403 de CloudFront** ("Request blocked") antes de llegar a la aplicación de Wompi.

No es la firma, ni la llave, ni el monto, ni la IP de salida. Es una regla anti-SSRF del WAF que se dispara por el **contenido del parámetro `redirect-url`**:

| `redirect-url` | Respuesta |
|---|---|
| (ausente) | 200 |
| `https://bateriariesgopsicosocial.com/...` | 200 |
| `http://localhost:3000/...` | **403** |
| `https://localhost:3000/...` | **403** |
| `http://127.0.0.1:3000/...` | **403** |

Se comprueba con `curl` a la URL del checkout, sin navegador. La misma IP y la misma llave dan 200 quitando ese parámetro, así que descarta VPN y entorno.

Para probar el flujo completo en local hace falta una **URL pública** (un túnel tipo cloudflared/ngrok) en `BRS_PUBLIC_URL`. Sin túnel se puede validar igual el ciclo: pagar con el `redirect-url` de producción y aplicar la transacción a mano con `POST /api/payments/verify` pasándole el `id` que Wompi deja en la URL de retorno.

### Sandbox vs producción
Lo decide el **prefijo de la llave pública**: `pub_test_` → `https://sandbox.wompi.co/v1`, `pub_prod_` → `https://production.wompi.co/v1`. No hay una env var aparte para el ambiente: con dos variables la app podría firmar con el secreto de un ambiente y cobrar en el otro. La UI muestra una insignia morada "sandbox" cuando aplica.

### Configuración en el dashboard de Wompi
- **URL de eventos**: `https://<dominio>/api/payments/wompi/events`.
- Copiar de allí `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` (firma de integridad) y `WOMPI_EVENTS_SECRET` (secreto de eventos). La llave privada **no** hace falta: el checkout y la consulta de transacciones no la usan.
- Sin `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` o precio, `GET /config` devuelve `enabled: false`, la página lo explica y `POST /checkout` responde `503` (fail-closed).

### Env vars
`WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`, `BRS_TEST_PRICE_COP` (entero en pesos), `BRS_TEST_PRICE_BULK_COP` (precio por volumen, opcional), `BRS_TEST_BULK_MIN_QTY` (umbral, default 250), `BRS_PUBLIC_URL` (base del `redirect-url`; fallback `FRONTEND_URL` y luego el host del request).

### Archivos
- `backend/migrations/20260903000001_add_wompi_payments.js`
- `backend/services/wompi.js` — firmas, consulta a Wompi, `applyTransaction()`
- `backend/routes/payments.js` — rutas + webhook
- `backend/routes/reports.js`, `participants.js`, `evaluations.js` — guardas y campos `paidAt` / `paidParticipants` / `unpaidCompletedParticipants`
- `backend/tests/wompi.test.js` — firma de integridad (ejemplo oficial de la doc) y checksum de eventos
- `frontend/pages/evaluator/payments.tsx`, `payments/result.tsx`, `components/PaymentShared.tsx`
- `frontend/pages/evaluator/dashboard.tsx` (opción G "Pagos" con "N por pagar"), `evaluations.tsx` (insignia por evaluación), `participants.tsx` (insignia "Sin pagar" en completadas)

## CO-MARCA POR EMPRESA (logo en la pantalla del participante)

`companies.logo_url` guarda el logo de la empresa, que se muestra **junto** al de la plataforma en el header del participante. NULL = solo la plataforma (comportamiento de siempre).

**Es distinto de `config/brand.ts`.** Esa marca es de la INSTANCIA y se hornea en build (`NEXT_PUBLIC_BRAND`), así que no sirve aquí: dentro de una misma instancia cada empresa necesita su propio logo. Por eso va en la base y no en una env var.

- Se guarda una **ruta o URL**, no la imagen. Los assets propios viven en `frontend/public/brand/<marca>/`.
- El backend lo devuelve en `GET /api/participant-access/validate/:token` como `company: { name, logoUrl }`.
- Lo pinta `ParticipantLayout` en `participant/evaluation/[token].tsx`, con un separador y `rounded` — el archivo de REGIS trae su propio fondo sólido y sin esquinas se ve como una calcomanía pegada al header.
- El `alt` va **vacío a propósito**: el logotipo trae su propia razón social, que no tiene por qué coincidir con `companies.name` (en el caso de Manuela Beltrán el logo es de la consultora que aplica la medición, no de la empresa evaluada). Un alt armado con el nombre de la base leería mal.
- **No aparece en la barra del cuestionario a pantalla completa** ni en `/acceso`: en la primera no hay logo de nadie (es back + nombre + progreso) y en la segunda todavía no se sabe de qué empresa es la persona.

> ⚠️ **Todavía no hay UI para asignarlo.** Se setea por SQL: `UPDATE companies SET logo_url = '/brand/<marca>/logo.jpeg' WHERE nit = '<nit>'`. Usar el **NIT** y no el id: el mismo id es otra empresa distinta en cada instancia.

Hoy configurado: `Universidad Manuela Beltran` (NIT 860.517.647-5) → `/brand/regis/logo.jpeg`.

## PUERTA GENERAL DE ACCESO (`/acceso`)

Un solo enlace público para toda la instancia: la persona escribe su número de documento y entra a su batería. Evita tener que repartir cientos de enlaces individuales por WhatsApp o correo.

`POST /api/participant-access/lookup` resuelve el documento contra los `participant_evaluations` que esa persona ya tiene. **No crea nada**: si el documento no está en la lista que importó el evaluador, no entra.

### Qué devuelve y qué no
- Devuelve una **lista** de coincidencias, no un solo token: la misma persona puede estar en dos evaluaciones abiertas a la vez (dos empresas, o una repetición anual) y el frontend le pregunta a cuál quiere entrar. Adivinar la metería a contestar la batería equivocada.
- **No devuelve el nombre** de la persona. Con el documento como única llave, devolverlo convertiría la puerta en un directorio de "quién trabaja dónde". El nombre lo ve en la pantalla siguiente, que ya exige el token.
- Distingue `404 NOT_FOUND` (ese documento no está en ninguna lista) de `409 NOT_AVAILABLE` (existe, pero su evaluación no está `active`). Mandan a la persona a resolver cosas distintas.
- Solo considera evaluaciones `active`. Las baterías ya `completed` **sí** siguen siendo alcanzables: el Brief COPE se responde después de terminar (nota 12).

### Tokens vencidos: se renueva la fecha, no el token
Si el `access_token` está vencido, se corre `token_expires_at` 90 días en vez de generar uno nuevo — regenerarlo dejaría en 404 el enlace individual que ya se había enviado. A los PE anteriores a la columna `access_token` se les emite uno en ese momento, o esa persona no podría entrar por ningún medio.

### El límite de intentos es lo único que protege esta puerta
El documento **no es un secreto**: va en cualquier planilla de nómina. Se aceptó ese riesgo a cambio de que nadie quede varado sin su enlace.

Cuentan solo los intentos **fallidos** (`skipSuccessfulRequests`) y, además, un acierto **borra** los fallos acumulados de esa IP (`lookupLimiter.resetKey`). Las dos cosas apuntan a lo mismo: una empresa entera responde desde una sola IP de oficina, así que un contador limpio por IP se llenaría con los errores de tipeo de los primeros y bloquearía a los cientos restantes — justo el modo de falla que este enlace existe para evitar.

> ⚠️ El precio, sin adornos: quien ya conozca **una** cédula válida puede intercalar un acierto para limpiar el contador y seguir barriendo. Frena al curioso, no al decidido. La defensa de fondo sería pedir un segundo dato — el año de nacimiento ya viene en `demographic_data` de toda planilla importada.

### Todo enlace roto desemboca aquí
`/participant/evaluation/` **sin token** ya no cae al `index.html` genérico: redirige (302) a `/acceso`. El index no es una landing en las marcas sin sitio comercial — es el puente al login, que para un participante es un callejón sin salida, y si ese navegador tiene una sesión de evaluador abierta lo deja mirando el **dashboard del evaluador** (pasó en shaddai: el botón de un WhatsApp viejo llevó a un participante a esa pantalla). La pantalla de "token inválido" lleva al mismo lugar, con el texto "Ingresar con mi número de documento".

De paso, el fallback de `server.js` ahora resuelve la ruta **sin el query string**: `/participant/evaluation/<token>?utm=x` servía el index en vez de la batería.

### Archivos
- `backend/routes/participant-access.js` — `POST /lookup` + `lookupLimiter`
- `backend/migrations/20260826000001_add_document_number_index.js` — índice de expresión sobre `demographic_data->>'documentNumber'` (sin él cada ingreso escanea toda la tabla, y con este enlace la empresa entera entra a la vez)
- `frontend/pages/acceso.tsx` — formulario + selector cuando hay más de una evaluación

## BRIEF COPE OPCIONAL POR EVALUACIÓN

El COPE-28 **no hace parte de la batería oficial** del Ministerio (Resolución 2646/2008): es un instrumento adicional que algunos clientes contratan y otros no. Hasta ahora se le ofrecía a todo participante de toda instancia, así que quien no lo había contratado igual veía 28 preguntas extra y su informe podía traer una sección que nadie pidió.

`evaluations.include_coping` (boolean, NOT NULL, **default `true`**) decide si la campaña lo aplica. Se marca/desmarca en el modal de crear o editar evaluación en `/evaluator/evaluations`.

### Por qué el default es `true`
Las evaluaciones que ya existen vienen aplicándolo y sus participantes pueden tener respuestas guardadas. Un default `false` habría hecho desaparecer del informe datos ya recogidos, en silencio y en el momento del deploy.

### Apagarlo no borra nada
Las `responses` y `results` de `coping` que ya estén en la base se quedan ahí: solo dejan de ofrecerse y de imprimirse. Volver a encender la bandera los recupera. Por eso el filtro del informe es por bandera y no por presencia de datos — una campaña que lo apagó después de recoger algunas respuestas no debe imprimir una sección con la mitad de la población.

### El bloqueo vive en el backend, no en la UI
Ocultarlo del hub no basta: `GET /:token/questionnaire/:type` y `POST /:token/responses` son públicos y la ruta es adivinable. Ambos responden por su cuenta (`404` y `403 COPING_NOT_INCLUDED`). `POST /api/responses` (carga por el evaluador) responde `400`.

### La completitud del PE también depende de la bandera
Para los participantes provisionados por integración los 5 cuestionarios son obligatorios, COPE incluido. Si la evaluación no lo aplica, **no** puede exigirse: el participante nunca lo ve, así que el PE quedaría atascado en `in_progress` para siempre y sin webhook de finalización. La lógica está duplicada en `participant-access.js` y en `finalizePeStatus()` de `photo-import.js` — al tocar una hay que tocar la otra.

### Informes
El filtro se aplica al leer la tabla `results`, antes de agregar:
- **Individual** (`POST /reports/individual`) — se descartan las filas `coping`, así que no se dibuja su página.
- **Organizacional** (`POST /reports/organizational`) — se descartan de `allResults` y de los resúmenes individuales embebidos; el agregador cuenta 0 y la sección "ESTRATEGIAS DE AFRONTAMIENTO" no se dibuja (ya era condicional a `copingTotal > 0`).

Los textos estáticos del informe organizacional no mencionan el COPE (describen solo la batería oficial), así que no hubo que condicionarlos.

### Archivos
- `backend/migrations/20260902000001_add_include_coping_to_evaluations.js`
- `backend/routes/evaluations.js` — `includeCoping` en los schemas Joi y en las respuestas del API
- `backend/routes/participant-access.js` — helper `copingIncluded()` + guards
- `backend/routes/photo-import.js` — `finalizePeStatus()`
- `backend/routes/responses.js` — guard de la carga por el evaluador
- `backend/routes/reports.js` — filtro de las filas `coping`
- `frontend/pages/evaluator/evaluations.tsx` — casilla en el modal + insignia "Con Brief COPE" en la lista

> El frontend del participante no necesitó cambios: el hub se dibuja a partir de la lista que devuelve el backend, y las barras de progreso ya toleraban la ausencia del COPE.

## CONSENTIMIENTO INFORMADO DEL PARTICIPANTE

**Obligatorio en TODAS las instancias** (no es opt-in como la verificación facial). Es la primera pantalla que ve el participante al abrir su enlace, antes del menú de cuestionarios.

**Por qué es obligatorio.** La Resolución 2646/2008 y la Ley 1090/2006 lo exigen para aplicar la batería; sin él la medición es legalmente impugnable. La Ley 1581/2012 lo exige para tratar los datos, y con más razón aquí: las respuestas sobre salud psicológica son **datos sensibles** (art. 5), igual que la foto del rostro en las instancias con verificación facial. Además, el informe organizacional ya afirmaba que el consentimiento se había aplicado (`report-templates.js`), cosa que era falsa mientras la plataforma no lo recogía.

### Flujo
1. Al abrir el enlace, antes de cualquier otra cosa, se muestra el texto completo.
2. Una casilla obliga a un acto deliberado ("Leí y entendí…"). Un consentimiento que se acepta de un clic reflejo no es informado.
3. **Acepto** → se guarda `consent_accepted_at`, la IP, y un **snapshot del texto exacto** que se le mostró.
4. **No autorizo** → se guarda `consent_declined_at` y ve una pantalla de salida. Puede volver y aceptar: la participación es voluntaria y cambiar de opinión hace parte de eso.

### Los guards van en el backend
`POST /:token/responses` y `POST /:token/face` responden `403 CONSENT_REQUIRED` sin consentimiento. El de `/face` es el legalmente crítico: **no se captura ni se envía a AWS ninguna imagen del rostro antes de la autorización**, porque el dato biométrico es sensible y requiere autorización previa, expresa e informada.

### Por qué se guarda un snapshot del texto
`participant_evaluations.consent_text` guarda copia de lo que esa persona leyó. El evaluador puede editar el texto de la evaluación después, y sin la copia no habría forma de probar **qué** fue lo que aceptó. Editar el texto no invalida los consentimientos ya firmados.

### Texto editable por evaluación
- Default: `backend/utils/consent-template.js` — arma el texto con el nombre de la empresa y la marca; la sección de datos biométricos aparece solo si `FACE_VERIFICATION_ENABLED`.
- Override: `evaluations.consent_text_override` (NULL = usar el default). Se edita desde `/evaluator/evaluations` (ícono de escudo).
- `GET|PUT /api/evaluations/:id/consent-text`.
- Guardar un texto idéntico al default lo persiste como NULL, para que la evaluación siga heredando mejoras de la plantilla en vez de congelarse.

> ⚠️ **El texto por defecto es un borrador de referencia, no asesoría legal.** Debe revisarlo el psicólogo responsable de cada instancia. La UI del evaluador lo advierte de forma explícita.

### Formato del texto
Texto plano con un contrato mínimo para que un evaluador lo edite sin saber HTML: `## Título` para secciones, `- ` para viñetas, `**negrita**`, línea en blanco para párrafo nuevo. Lo renderiza `frontend/components/ConsentText.tsx` a mano (sin librería de markdown) para que no haya ninguna ruta que inyecte HTML en la página del participante.

### Visibilidad para el evaluador
`/evaluator/participants` marca con una insignia ámbar a quien **no autorizó**. Solo se marca el rechazo: aceptar es lo esperado y marcarlo en cientos de filas sería ruido. Distinguir "rechazó" de "nunca abrió el enlace" importa para no perseguir a quien ya dijo que no, y para reportar cobertura con honestidad.

### Archivos
- `backend/migrations/20260801000001_add_informed_consent.js`
- `backend/utils/consent-template.js` — texto por defecto
- `backend/routes/participant-access.js` — `GET|POST /:token/consent` + guards
- `backend/routes/evaluations.js` — `GET|PUT /:id/consent-text`
- `frontend/components/ConsentText.tsx` — renderizador
- `frontend/pages/participant/evaluation/[token].tsx` — pantalla bloqueante

## VERIFICACIÓN FACIAL DEL PARTICIPANTE (opt-in por instancia)

Anti-suplantación en el link público del participante: confirma que quien responde la batería es la misma persona de principio a fin. **Portado de BODYTECH-PREPAGADAS** (`/atender`), con dos diferencias: aquí **bloquea** (allá es informativo) y la referencia vive en la batería, no en la persona.

**Está apagado por defecto.** Solo se activa donde se ponga `FACE_VERIFICATION_ENABLED=true` (hoy: app `brs-shaddai`). Sin esa env var nada de esto se ve ni se ejecuta, y el flujo del participante es el de siempre.

### Flujo: UNA VERIFICACIÓN POR CUESTIONARIO
La cara se pide al **entrar a cada formulario** (5 por batería), no cada N minutos.

1. **Primer cuestionario** — el participante toma una selfie. Pasa por `DetectFaces` (gate de calidad: un solo rostro, de frente, nítido, ojos abiertos, sin oclusión). Si pasa, se guarda como referencia en `participant_evaluations.face_reference_photo`. Si no pasa, **no se guarda** y se le devuelven los problemas concretos ("foto muy borrosa", "quítate las gafas oscuras") — con bloqueo, una referencia mala condenaría a fallar todas las verificaciones siguientes.
2. **Cuestionarios siguientes** — selfie → `CompareFaces` contra la referencia. Umbral 90% (`FACE_MATCH_THRESHOLD`).
3. Cada verificación queda atada a su `questionnaire_type` en `face_verifications`: la de un cuestionario **no** sirve para otro.

> **Por qué no por tiempo.** La primera versión usaba una ventana de 4h (`FACE_SESSION_MINUTES`, ya eliminada). La batería completa toma 20-40 min, o sea que cabía entera dentro de una sola ventana: se pedía la cara una vez al principio y nunca más, y no se comprobaba continuidad alguna. Atarla al cuestionario da 5 comprobaciones, siempre en el mismo punto y sin interrumpir a mitad de una pregunta.

Esto prueba **continuidad** (la misma persona respondió toda la batería), no identidad contra un documento: nadie valida quién es esa cara en el primer cuestionario.

### El bloqueo se aplica en el backend, no en la UI
`POST /:token/responses` exige una verificación exitosa **para ese `questionnaireType`** y responde `403 FACE_VERIFICATION_REQUIRED` si no la hay. La pantalla del participante es la cara visible de la regla, no la regla: el endpoint es público y sin el guard bastaría un POST directo para saltársela.

**La UI es más estricta que el guard, a propósito.** `GET /:token/face-status` no devuelve qué cuestionarios ya están verificados: el frontend arranca con la lista vacía en cada carga de página y pide la cara al entrar a cada cuestionario de esa sesión. Si se sembrara con las verificaciones históricas, quien abandona un cuestionario a medias y vuelve más tarde entraría sin mostrar la cara. El guard (una verificación por `questionnaire_type`, sin caducidad) es la red contra POST directos, no el criterio de cuándo preguntar.

Si la instancia tiene el flag prendido pero **sin credenciales de AWS**, se **falla cerrado** (`503 FACE_UNAVAILABLE`) con mensaje legible. Dejar pasar anularía en silencio el control contratado.

### Válvula de escape (obligatoria en modo bloqueante)
Un falso negativo (mala luz, cámara de gama baja) deja al trabajador varado. En `/evaluator/participants` hay un botón por participante (ícono de huella, solo visible si el módulo está activo) que abre el estado del enrolamiento + la bitácora de intentos y permite **reiniciar el registro facial**: borra la referencia para que se re-enrole en su próximo ingreso. La bitácora **no** se borra — es el rastro de por qué hubo que reiniciar.

### Archivos
- `backend/utils/rekognition.js` — `validateFaceImage` (DetectFaces) y `compareFaces` (CompareFaces) + los flags. CommonJS.
- `backend/migrations/20260730000001_add_face_verification.js` — `participant_evaluations.face_reference_photo/at` + tabla `face_verifications`.
- `backend/routes/participant-access.js` — `GET /:token/face-status`, `POST /:token/face`, guard en `POST /:token/responses`.
- `backend/routes/participants.js` — `GET /face-verification-status` (probe de capacidad), `GET /:id/face`, `POST /:id/reset-face`.
- `frontend/components/FaceCapture.tsx` — captura con `getUserMedia` + canvas (640×480 JPEG 0.8), sin dependencias.
- `frontend/pages/participant/evaluation/[token].tsx` — gate antes del hub y de los cuestionarios.

### Notas
- **Solo se archiva la selfie de los intentos fallidos** (y la del enrolamiento). Guardar todas las exitosas engordaría la tabla sin aportar evidencia.
- **Rate limit por token, no por IP** (25 intentos / 15 min): una empresa entera responde desde una sola IP pública de oficina y limitar por IP dejaría fuera a los compañeros del que reintenta. Además acota el gasto — cada intento es una llamada facturada a AWS. El tope contempla 5 verificaciones legítimas por batería más reintentos.
- **El flag es una sola env var, resuelta en el backend.** El frontend pregunta por `GET /api/participants/face-verification-status` en vez de usar una `NEXT_PUBLIC_` paralela: con dos variables la UI podría mentir sobre lo que el backend realmente exige.
- Baterías ya completadas no vuelven a pedir selfie (no hay nada que escribir).
- `GET /face-verification-status` va **antes** de `/:id` en `participants.js` — mismo gotcha que `/whatsapp-status` (nota 11).

### Env vars
`FACE_VERIFICATION_ENABLED` (`'true'` para activar), `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (SECRET), `FACE_MATCH_THRESHOLD` (default 90). Requiere permisos IAM `rekognition:DetectFaces` y `rekognition:CompareFaces`.

## GENERACIÓN DE REPORTES PDF

**Archivo principal**: `backend/routes/reports.js`
**Librería**: PDFKit con `bufferPages: true` (requerido para footers con `switchToPage`)
**Módulos auxiliares**:
- `backend/utils/pdf-charts.js` — Funciones de dibujo: `drawPieChart`, `drawBarChart`, `drawGroupedBarChart`, `drawTable`, `createRiskSeries`
- `backend/utils/report-templates.js` — Textos estáticos (introducción, marco legal/teórico, metodología, procedimiento), mapeos `DIMENSION_DISPLAY_NAMES`, `DOMAIN_DIMENSIONS`, `INTERVENTION_RECOMMENDATIONS`, generadores dinámicos de análisis
- `backend/utils/report-data-aggregator.js` — `aggregateDemographics()` (ficha_datos → género/edad/escolaridad/dependientes), `aggregateResultsByForm()` (resultados separados por forma A/B con conteos de riesgo por dimensión/dominio), `getAtRiskDimensions()`

### Reporte Individual (~5 páginas)
- Portada con título y datos del Ministerio
- Datos del participante (email, empresa, evaluación, cargo, etc.)
- Por cada cuestionario: resumen de riesgo, resultados por dominio con barras visuales, tabla de dimensiones
- Página de interpretación y recomendaciones
- Footers con fecha y paginación

### Reporte Organizacional (~22-35 páginas, profesional)
Basado en formato de referencia `informe.pdf` del Ministerio. Estructura:
1. **Portada** — Título, nombre empresa, evaluador, ciudad y fecha
2. **Tabla de contenido** — Con números de página (backfill vía `switchToPage`)
3. **Introducción** — Contexto de riesgo psicosocial y normatividad colombiana
4. **Marco Referencial** — Resolución 2646/2008, Ley 1010/2006, Resolución 2764/2022
5. **Marco Teórico** — Definiciones (riesgo psicosocial, estrés, factor protector, etc.)
6. **Aspectos Generales** — Objetivos, alcance, población (Forma A: X, Forma B: Y)
7. **Ficha Sociodemográfica** — 4 gráficas de torta (género, edad, escolaridad, dependientes) con análisis
8. **Metodología** — Tablas de dominios/dimensiones intralaborales, extralaborales, escala de riesgo
9. **Procedimiento** — Descripción de aplicación digital
10. **Condiciones Intralaborales** — Gráficas de barras (general, Forma A, Forma B)
11. **Dominios por Forma** — Gráficas de barras agrupadas (4 dominios × 5 niveles de riesgo)
12. **Detalle por Dominio** — 4 dominios × 2 formas con gráficas agrupadas por dimensión + texto de análisis dinámico
13. **Condiciones Extralaborales** — Gráficas agrupadas (general + por forma) con 7 dimensiones
14. **Estrés** — Gráfica de torta + efectos en salud (fisiológicos, psicológicos, comportamentales)
15. **Plan de Intervención** — Tabla con dimensiones en riesgo, recomendaciones y población objetivo
16. **Recomendación Prioritaria** — Lista numerada de acciones prioritarias
17. **Conclusiones** — Resumen dinámico + dimensiones de mayor atención + firma del evaluador

### Notas técnicas de PDFKit
- **switchToPage + addPage bug**: Al usar `switchToPage()` y luego `doc.text()`, PDFKit crea páginas extras. Solución: monkey-patch `doc.addPage = () => doc` durante loops de footer/TOC backfill, restaurar después.
- **Gráficas SVG path**: Pie charts usan `doc.path()` con arcos SVG (`M`, `L`, `A`, `Z`). Bar charts usan `doc.rect()` con efecto 3D (caras lateral/superior con `darkenColor`/`lightenColor`).
- **Tablas con auto page-break**: `drawTable()` verifica espacio restante y redibuja headers en nueva página.

## SISTEMA DE UI - FLOWLAYOUT

### Arquitectura de Layouts
La UI usa dos sistemas de layout:

1. **FlowLayout** (`frontend/components/FlowLayout.tsx`) — Layout principal Typeform-style
   - Header minimalista: back button + logo centrado + avatar/logout
   - Dos modos según `maxWidth`:
     - **Hub** (`maxWidth="3xl"`): Fondo gradiente `from-slate-50 to-blue-50`, contenido centrado
     - **Data** (`maxWidth="full"`): Fondo neutro `bg-gray-50`, padding amplio `px-6 lg:px-10`
   - Auth check automático (redirige a login si no hay token)

2. **Layout** (`frontend/components/Layout.tsx`) — Sidebar legacy (solo participantes)

### Componentes Flow
- **FlowOption** — Card con letra (A, B, C...), icono, título, descripción, badge, arrow. Para menús hub
- **FlowQuestion** — Título de pregunta con greeting estilo Typeform
- **FlowStats** — Barra de estadísticas compactas (4 valores)
- **useFlowKeyboard** — Hook: presionar A-Z navega a la opción correspondiente

### Pantalla de aplicación de cuestionarios (participante)
`frontend/pages/participant/evaluation/[token].tsx` — vista full-screen "una pregunta = una pantalla".
No usa FlowLayout ni ParticipantLayout: es un contenedor propio de tres zonas fijas.

- **Estructura**: contenedor `flex flex-col overflow-hidden` con alto de viewport; `<header>` (salir + nombre + `N / total` + barra de progreso), `<main>` con el scroll (`flex-1 overflow-y-auto`) y `<footer>` con el CTA. Header y footer NO usan `sticky`: `globals.css` tiene `overflow-x: hidden` en `html/body`, lo que rompe `position: sticky`. El scroll vive dentro de `<main>`.
- **Alto del viewport**: `h-[100dvh]` como base + `style={{height: visualViewport.height}}`. En iOS el teclado no encoge `100dvh`; sin la medida de `visualViewport` el botón "Continuar" queda tapado por el teclado.
- **Progreso**: la barra refleja la **posición** (`índice / total`), no el % de respuestas guardadas. Con la ficha pre-llenada por el evaluador ambos números no coinciden y el % se leía como bug.
- **Pregunta anclada arriba** (`items-start`), no centrada: con centrado vertical el título salta de posición entre preguntas de distinta altura.
- **CTA único** (`handleContinue`): avanza, o finaliza en la última. Si al finalizar faltan respuestas, salta a la primera pendiente con un toast en vez de quedarse bloqueado sin explicación.
- **Rama demográfica vs escala**: se decide por `questionnaire.campos` (el cuestionario), no por el campo. Un campo de ficha sin `tipo` ni `opciones` caía antes en el render de escala Likert.
- Campos de opciones: ≤ 12 opciones → tarjetas de un toque; > 12 → `<select>` nativo. El umbral era 8, y con eso **"Último nivel de estudios" (12 opciones) era el único campo de la ficha que caía en el desplegable nativo**: en pantallas chicas el popup se corta y las últimas opciones (Carrera militar / policía, Posgrado incompleto/completo) parecían no existir. Hoy los 10 campos con opciones de la ficha se pintan igual.

### Patrón de uso
```tsx
// Hub (dashboard): centrado con gradiente
<FlowLayout showBack={false}>
  <FlowQuestion greeting="Hola, user" question="Que deseas hacer?" />
  <FlowOption letter="A" title="Empresas" href="/evaluator/companies" badge="3 empresas" />
  <FlowStats items={[{label: 'Empresas', value: 3}]} />
</FlowLayout>

// Data page: full width con bg neutro
<FlowLayout backHref="/evaluator/dashboard" backLabel="Volver al menu" maxWidth="full">
  <table>...</table>
</FlowLayout>
```

## NAVEGACIÓN POR ROL

### Admin
- Dashboard (hub) → `/admin/dashboard`
- Empresas → `/admin/companies`
- Usuarios → `/admin/users`

### Evaluador
- Dashboard (hub) → `/evaluator/dashboard`
- Empresas → `/evaluator/companies` (CRUD con ownership)
- Evaluaciones → `/evaluator/evaluations` (selector de empresa al crear)
- Participantes → `/evaluator/participants`
- Resultados → `/evaluator/results`
- Dashboard Resultados → `/evaluator/results-dashboard`
- Dashboard Organizacional → `/evaluator/organizational-dashboard`
- Reportes → `/evaluator/reports`
- Pagos → `/evaluator/payments` (pruebas pendientes + checkout Wompi; retorno en `/evaluator/payments/result`)

### Participante
- Dashboard → `/participant/dashboard`
- Cuestionarios → `/participant/questionnaires`
- Mis Resultados → `/participant/results`

### Público
- Puerta general del participante → `/acceso` (entra con el número de documento)

### Auth
- Login → `/auth/login`
- Registro → `/auth/register` (auto-registro de evaluadores)

## COMANDOS

```bash
# Desarrollo local
cd backend && npm run dev    # Backend en puerto 5000
cd frontend && npm run dev   # Frontend en puerto 3000

# Build producción
npm run build                # Build frontend + backend

# Migraciones (corren auto en el deploy via npm start)
cd backend && npm run db:migrate    # Aplicar migraciones pendientes
cd backend && npm run db:rollback   # Revertir última migración

# Deploy (auto-deploy en push a main)
git push origin main

# Verificar deploy
~/bin/doctl apps list-deployments 420e1df4-744a-4442-a9b9-87c8b8603eb7 --format ID,Phase,Progress

# Ver logs
~/bin/doctl apps logs 420e1df4-744a-4442-a9b9-87c8b8603eb7 --type run    # Runtime
~/bin/doctl apps logs 420e1df4-744a-4442-a9b9-87c8b8603eb7 --type build --deployment <id>   # Build
~/bin/doctl apps logs 420e1df4-744a-4442-a9b9-87c8b8603eb7 --type deploy --deployment <id>  # Migraciones + arranque
```

## DEPENDENCIAS CLAVE

### Backend
- express, cors, helmet, morgan
- knex + pg (PostgreSQL con SSL)
- bcrypt, jsonwebtoken (auth)
- pdfkit (reportes PDF, requiere `bufferPages: true`)
- express-rate-limit

### Frontend
- next, react, react-dom
- typescript, tailwindcss
- @heroicons/react, lucide-react
- react-hot-toast
- recharts (gráficos)
- react-hook-form, @hookform/resolvers, yup (validación formulario registro)

## NOTAS TÉCNICAS IMPORTANTES

1. **SSL de DB**: Conexión usa `ssl: { rejectUnauthorized: false }` - requerido por DigitalOcean managed DB.
2. **knexfile.js SSL gotcha**: El campo `ssl` debe ir DENTRO del objeto `connection`, no como hermano. Si está como hermano, `pg` lo ignora y el connect falla con `no pg_hba.conf entry … no encryption`. La config de `production` tenía este bug y rompía el `knex migrate:latest` en arranque.
3. **API URL en frontend**: `config/api.ts` usa URL relativa en browser (mismo origen), `localhost:5000` en SSR. Variable `NEXT_PUBLIC_API_URL` para override.
4. **PDFKit bufferPages**: SIEMPRE usar `bufferPages: true` al crear PDFDocument si se necesitan footers con `switchToPage()`.
5. **Resultados pre-calculados**: Los reportes PDF leen de la tabla `results` (pre-calculados), no recalculan.
6. **Deploy time**: ~15 minutos en DigitalOcean. `doctl` a veces retorna exit code 1 pero output es válido.
7. **Frontend export**: Next.js en modo `output: 'export'` (estático). No soporta API routes del lado frontend ni SSR.
8. **Ownership filtering**: Todas las rutas de evaluador usan `getOwnedCompanyIds(req.user.userId)` → `whereIn('company_id', ownedIds)` para aislar datos entre evaluadores.
9. **FlowLayout maxWidth**: Hub pages usan `"3xl"` (gradiente), data pages usan `"full"` (bg-gray-50 neutro). No mezclar — las cards blancas se ven mal sobre gradiente en full-width.
10. **Font ibrand**: Cargada via `@font-face` en `globals.css` desde `frontend/public/fonts/ibrand.otf`. Clase Tailwind: `font-ibrand` (configurada en `tailwind.config.js`).
11. **audit_logs columnas**: La tabla en producción usa `table_name`, `record_id`, `old_values`, `new_values` (NO `entity_type`/`entity_id`/`details`). Hay endpoints viejos con los nombres equivocados que fallan el insert silenciosamente y devuelven 500 al usuario aunque la operación principal sí completó. Buscar en logs por `column "details"` para detectarlos.
12. **El Brief COPE se responde DESPUÉS de completada la batería**. `coping` no cuenta para marcar el PE como `completed` (solo ficha/intralaboral/extralaboral/estrés), pero el hub lo sigue ofreciendo (si la evaluación lo aplica — ver *Brief COPE opcional*). El guard de `POST /:token/responses` bloqueaba por estado del PE, así que quien dejaba el COPE de último perdía sus 28 respuestas con un 409 que el frontend mostraba como "revisa tu conexión". Ahora el 409 es **por cuestionario**: se puede terminar uno que nunca se terminó, no rehacer uno ya completado. El webhook de finalización solo se emite en la transición, para no re-notificar al guardar el COPE tardío.
13. **Deriva de esquema: `coping` en las CHECK constraints**. El Brief COPE se añadió a la app pero la constraint de `responses`/`results` solo se amplió A MANO en la base de BRS principal. Toda base creada desde migraciones (shaddai y cualquier licenciatario nuevo) se quedó sin `coping`, así que el participante perdía sus 28 respuestas con un 500 al guardar. Corregido en la migración `20260731000002`. **Antes de entregar una instancia nueva, diffear el esquema real contra el que producen las migraciones** — este no tiene por qué ser el único caso.
14. **Tablas con scroll fijo**: Para tablas largas, usar `<div className="overflow-auto h-[calc(100vh-260px)] min-h-[300px]">` con `<thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">`. `max-h-[Nvh]` permite que la página crezca y deja el scrollbar fuera del viewport.
15. **Paginación con `LIMIT/OFFSET` necesita un ORDER BY único**: `participants.created_at` NO es único — una importación de Excel inserta cientos de filas con el mismo timestamp (en shaddai ~700 comparten uno solo). Ante empates Postgres no garantiza orden estable entre consultas, y el frontend pide las páginas **en paralelo**: las páginas se solapaban, de 945 filas traídas llegaban 821 participantes distintos (124 repetidos, otros 124 invisibles). Siempre desempatar con `.orderBy('<tabla>.id', 'desc')`.
16. **Redacción del token en los logs, caso `/validate`**: `redactAccessToken()` en `server.js` tapaba el primer segmento después de `/participant-access/`, pero en `GET /api/participant-access/validate/<token>` ese segmento es `validate` y el token quedaba **en claro** en los logs de producción. Es la primera llamada que hace toda persona al abrir su batería, así que con la puerta general serían cientos de tokens vivos impresos. Corregido con una regla propia para `/validate/`. Al agregar rutas nuevas con el token en otra posición, revisar esa función.
17. **La `key` de una fila de participante es (participante, evaluación), no el id**: un participante puede estar en dos evaluaciones y el JOIN devuelve una fila por cada una. Con `key={p.id}` duplicada, React deja **filas fantasma** en el DOM al filtrar — la tabla mostraba 125 filas mientras el contador decía "1 resultado(s)", que se lee como "el buscador no filtra".

## ESTADO DEL PROYECTO

### Completado
- [x] Extracción completa de 282 preguntas del documento oficial
- [x] Baremos oficiales (Tablas 29-34 del Ministerio) - 45 dimensiones, 10 dominios
- [x] Motor de cálculo con fórmula oficial BRS
- [x] API REST completa (11 módulos de rutas)
- [x] Base de datos PostgreSQL desplegada en DigitalOcean
- [x] Autenticación JWT con roles (admin, evaluator, participant)
- [x] Frontend completo con 20+ páginas
- [x] CRUD de empresas y usuarios (admin)
- [x] Gestión de evaluaciones y participantes (evaluador)
- [x] Aplicación de cuestionarios con progreso (participante)
- [x] Cálculo de resultados con clasificación automática
- [x] Visualización de resultados por dimensión y dominio
- [x] Dashboard de resultados individuales y organizacionales
- [x] Generación de reportes PDF individuales y organizacionales
- [x] Desplegado en producción (DigitalOcean App Platform)
- [x] Corrección mapeo ítems-dimensiones según Tabla 23 oficial (Forma A, B, Extralaboral)
- [x] Implementación de ítems invertidos (Tablas 21, 22, 11)
- [x] Factores de transformación oficiales (Tablas 25, 26, 14)
- [x] Baremos duales extralaborales (Tabla 17 jefes / Tabla 18 auxiliares)
- [x] Baremos oficiales de estrés con puntuación ponderada (Tabla 4, Tabla 6)
- [x] Puntajes totales: intralaboral (Tabla 33), extralaboral, estrés
- [x] **Modelo SaaS multi-empresa** — evaluadores se auto-registran, crean y gestionan múltiples empresas
- [x] **Auto-registro de evaluadores** — `/auth/register` sin empresa obligatoria
- [x] **Ownership-based filtering** — `companies.created_by` + `getOwnedCompanyIds()` para aislamiento
- [x] **CRUD empresas por evaluador** — `/evaluator/companies` con verificación de ownership
- [x] **Selector de empresa al crear evaluación** — dropdown con empresas propias
- [x] **UI Typeform-style** — FlowLayout con hubs (dashboards) y data pages (tablas full-width)
- [x] **Componentes Flow** — FlowOption, FlowQuestion, FlowStats, useFlowKeyboard
- [x] **Font personalizado ibrand** — branding consistente en header
- [x] **Importación masiva por Excel** — detector header-aware tolerante a layouts no estándar (acepta texto o numérico, salta columnas filtro)
- [x] **Modal de previsualización** — flujo select → preview → result antes de persistir
- [x] **Sistema de migraciones Knex** — auto-aplicación en arranque del container
- [x] **Constraint de email per-empresa** — `participants.email` único por `(company_id, email)` para que múltiples empresas importen los mismos documentos
- [x] **Tabla de participantes con scroll fijo** — `h-[calc(100vh-260px)]` + sticky header
- [x] **Integración server-to-server** — `POST /api/integration/participant` (auth `X-Api-Key`, idempotente por `externalRef`) + webhook `evaluation.completed` firmado con HMAC
- [x] **Auto-redirect de retorno desactivado** — el participante ya no es redirigido a la app externa al terminar; se queda en la pantalla de éxito de BRS (webhook sigue notificando)
- [x] **Brief COPE opcional por evaluación** — `evaluations.include_coping` decide si la campaña aplica el COPE-28; si no, el participante no lo ve y su sección no sale en el informe
- [x] **Consentimiento informado del participante** — pantalla bloqueante antes del menú, en todas las instancias; registro de aceptación/rechazo con IP y snapshot del texto; editable por evaluación
- [x] **Co-marca por empresa** — `companies.logo_url` pinta el logo de la empresa junto al de la plataforma en la pantalla del participante (hoy: REGIS en Universidad Manuela Beltrán); sin UI todavía, se asigna por SQL
- [x] **Puerta general de acceso** — enlace único `/acceso` donde el participante entra con su número de documento, sin repartir enlaces individuales; límite de intentos fallidos por IP que se reinicia con cada acierto
- [x] **Pago por prueba con Wompi** — el evaluador elige las pruebas sin pagar, paga el total en el Web Checkout y al aprobarse (webhook firmado + verificación directa contra Wompi) quedan marcadas como pagadas y liberan informes/exportación; el interruptor manual del admin (`evaluations.paid`) sigue vigente
- [x] **Verificación facial del participante** (AWS Rekognition, opt-in por instancia vía `FACE_VERIFICATION_ENABLED`, hoy solo `brs-shaddai`) — auto-enrolamiento + verificación bloqueante, guard en el backend, bitácora de intentos y reinicio desde la UI del evaluador

### Pendiente
- [ ] Tests unitarios y de integración
- [ ] Exportación de datos a Excel/CSV
- [ ] Notificaciones por email a participantes
- [ ] Dashboard admin con métricas del sistema
- [ ] Corregir endpoints que usan columnas viejas de `audit_logs` (`PUT /participants/:id`, `POST /responses/`, etc.)

## REFERENCIAS

- **Documento oficial**: https://dtalero78.github.io/bsl-presentacion/todos-brs-unificado.html
- **Marco legal**: Resolución 2646 de 2008
- **Validación**: Pontificia Universidad Javeriana - Ministerio de la Protección Social
