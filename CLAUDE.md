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
│   │   └── 20260731000002_allow_coping_questionnaire_type.js  # deriva: coping faltaba en las CHECK
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
│   │   └── system.js         # Config, health, baremos
│   ├── services/
│   │   └── webhook-emitter.js # Webhook evaluation.completed (HMAC-SHA256) a sistemas externos
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
- `POST /` - Crear (requiere `companyId` en body, evaluador elige empresa)
- `PUT /:id` | `POST /:id/assign`
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
- `POST /token/validate` - Validar token de acceso
- `GET /token/:token/questionnaires` - Cuestionarios disponibles
- `POST /token/:token/responses` - Guardar respuestas
- `GET /:token/face-status` - ¿Esta instancia exige verificación facial? ¿ya está enrolado/verificado?
- `POST /:token/face` - Enrola (1er ingreso) o verifica la selfie. Rate limit por token.

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
- Campos de opciones: ≤ 8 opciones → tarjetas de un toque; > 8 → `<select>` nativo.

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

### Participante
- Dashboard → `/participant/dashboard`
- Cuestionarios → `/participant/questionnaires`
- Mis Resultados → `/participant/results`

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
12. **Deriva de esquema: `coping` en las CHECK constraints**. El Brief COPE se añadió a la app pero la constraint de `responses`/`results` solo se amplió A MANO en la base de BRS principal. Toda base creada desde migraciones (shaddai y cualquier licenciatario nuevo) se quedó sin `coping`, así que el participante perdía sus 28 respuestas con un 500 al guardar. Corregido en la migración `20260731000002`. **Antes de entregar una instancia nueva, diffear el esquema real contra el que producen las migraciones** — este no tiene por qué ser el único caso.
13. **Tablas con scroll fijo**: Para tablas largas, usar `<div className="overflow-auto h-[calc(100vh-260px)] min-h-[300px]">` con `<thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">`. `max-h-[Nvh]` permite que la página crezca y deja el scrollbar fuera del viewport.

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
