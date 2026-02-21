# BRS - Batería de Riesgo Psicosocial

## RESUMEN DEL PROYECTO

Aplicación web completa para la evaluación de factores de riesgo psicosocial basada en la **Batería oficial del Ministerio de la Protección Social de Colombia** (Resolución 2646 de 2008). Desplegada en producción en DigitalOcean App Platform.

**URL Producción**: https://brs-abaxh.ondigitalocean.app
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
| Admin | admin@brsdigital.com | admin123 |
| Evaluador | evaluator@test.com | evaluator123 |
| Participante | carlos.ruiz@techcorp.com | (acceso por token) |

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
│   ├── config/
│   │   └── database.js       # Conexión PostgreSQL con Knex.js (SSL)
│   ├── middleware/
│   │   └── auth.js           # JWT verification & role-based auth
│   ├── routes/
│   │   ├── auth.js           # Login, register, refresh, logout
│   │   ├── companies.js      # CRUD empresas (admin)
│   │   ├── users.js          # CRUD usuarios (admin)
│   │   ├── evaluations.js    # Gestión de evaluaciones
│   │   ├── participants.js   # Gestión de participantes
│   │   ├── participant-access.js # Acceso público por token
│   │   ├── questionnaires.js # Servir cuestionarios
│   │   ├── responses.js      # Guardar/recuperar respuestas
│   │   ├── results.js        # Calcular y consultar resultados
│   │   ├── reports.js        # Generación de PDF (PDFKit)
│   │   └── system.js         # Config, health, baremos
│   └── utils/
│       ├── calculate-results.js  # Motor de cálculo BRS oficial
│       └── baremos-completos.js  # Baremos Tablas 29-34 del Ministerio
├── frontend/
│   ├── config/
│   │   └── api.ts            # API_URL config (relativa en prod, localhost en dev)
│   ├── components/
│   │   ├── Layout.tsx         # Sidebar + topbar con navegación por rol
│   │   ├── QuestionnaireForm.tsx # Formulario progresivo de cuestionarios
│   │   ├── ReportGenerator.tsx   # UI para generar reportes PDF
│   │   ├── ResultsDimensionCard.tsx
│   │   ├── ResultsDomainsChart.tsx
│   │   ├── ResultsInterpretation.tsx
│   │   └── RiskSummaryChart.tsx
│   ├── pages/
│   │   ├── index.tsx                    # Landing page (auto-redirect si logueado)
│   │   ├── _app.tsx                     # App wrapper
│   │   ├── auth/login.tsx               # Login
│   │   ├── admin/
│   │   │   ├── dashboard.tsx            # Dashboard admin
│   │   │   ├── companies.tsx            # CRUD empresas
│   │   │   └── users.tsx                # CRUD usuarios
│   │   ├── evaluator/
│   │   │   ├── dashboard.tsx            # Dashboard evaluador
│   │   │   ├── evaluations.tsx          # Gestión evaluaciones
│   │   │   ├── participants.tsx         # Gestión participantes
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
users (id, email, password_hash, role, company_id, active, created_at, updated_at)
companies (id, name, nit, contact_email, contact_phone, active, created_at, updated_at)
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
- `POST /login` - JWT login (devuelve token + user data)
- `POST /register` - Registro
- `POST /refresh` - Renovar token
- `POST /logout` - Cerrar sesión

### Empresas (`/api/companies`) - Solo admin
- `GET /` | `POST /` | `PUT /:id` | `DELETE /:id`

### Usuarios (`/api/users`) - Solo admin
- `GET /` | `POST /` | `PUT /:id` | `DELETE /:id`

### Evaluaciones (`/api/evaluations`)
- `GET /` | `POST /` | `PUT /:id` | `POST /:id/assign`

### Participantes (`/api/participants`)
- `GET /` | `POST /` | `PUT /:id` | `GET /evaluation/:evalId`

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

## GENERACIÓN DE REPORTES PDF

**Archivo**: `backend/routes/reports.js`
**Librería**: PDFKit con `bufferPages: true` (requerido para footers con `switchToPage`)

### Reporte Individual (15 páginas)
- Portada con título y datos del Ministerio
- Datos del participante (email, empresa, evaluación, cargo, etc.)
- Por cada cuestionario: resumen de riesgo, resultados por dominio con barras visuales, tabla de dimensiones
- Página de interpretación y recomendaciones
- Footers con fecha y paginación

### Reporte Organizacional (9 páginas)
- Portada con datos de la evaluación y empresa
- Distribución de niveles de riesgo con barras visuales
- Top 10 dimensiones con mayor riesgo
- Recomendaciones priorizadas (alta/media/controlada según % de riesgo alto)

## NAVEGACIÓN POR ROL

### Admin
- Dashboard → `/admin/dashboard`
- Empresas → `/admin/companies`
- Usuarios → `/admin/users`

### Evaluador
- Dashboard → `/evaluator/dashboard`
- Evaluaciones → `/evaluator/evaluations`
- Participantes → `/evaluator/participants`
- Resultados → `/evaluator/results`
- Dashboard Resultados → `/evaluator/results-dashboard`
- Dashboard Organizacional → `/evaluator/organizational-dashboard`
- Reportes → `/evaluator/reports`

### Participante
- Dashboard → `/participant/dashboard`
- Cuestionarios → `/participant/questionnaires`
- Mis Resultados → `/participant/results`

## COMANDOS

```bash
# Desarrollo local
cd backend && npm run dev    # Backend en puerto 5000
cd frontend && npm run dev   # Frontend en puerto 3000

# Build producción
npm run build                # Build frontend + backend

# Deploy (auto-deploy en push a main)
git push origin main

# Verificar deploy
~/bin/doctl apps list-deployments 420e1df4-744a-4442-a9b9-87c8b8603eb7 --format ID,Phase,Progress

# Ver logs
~/bin/doctl apps logs 420e1df4-744a-4442-a9b9-87c8b8603eb7 --type run
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

## NOTAS TÉCNICAS IMPORTANTES

1. **SSL de DB**: Conexión usa `ssl: { rejectUnauthorized: false }` - requerido por DigitalOcean managed DB.
2. **API URL en frontend**: `config/api.ts` usa URL relativa en browser (mismo origen), `localhost:5000` en SSR. Variable `NEXT_PUBLIC_API_URL` para override.
3. **PDFKit bufferPages**: SIEMPRE usar `bufferPages: true` al crear PDFDocument si se necesitan footers con `switchToPage()`.
4. **Resultados pre-calculados**: Los reportes PDF leen de la tabla `results` (pre-calculados), no recalculan.
5. **Deploy time**: ~15 minutos en DigitalOcean. `doctl` a veces retorna exit code 1 pero output es válido.
6. **Frontend export**: Next.js en modo `output: 'export'` (estático). No soporta API routes del lado frontend ni SSR.

## ESTADO DEL PROYECTO

### Completado
- [x] Extracción completa de 282 preguntas del documento oficial
- [x] Baremos oficiales (Tablas 29-34 del Ministerio) - 45 dimensiones, 10 dominios
- [x] Motor de cálculo con fórmula oficial BRS
- [x] API REST completa (11 módulos de rutas)
- [x] Base de datos PostgreSQL desplegada en DigitalOcean
- [x] Autenticación JWT con roles (admin, evaluator, participant)
- [x] Frontend completo con 20 páginas
- [x] Navegación por rol con sidebar
- [x] CRUD de empresas y usuarios (admin)
- [x] Gestión de evaluaciones y participantes (evaluador)
- [x] Aplicación de cuestionarios con progreso (participante)
- [x] Cálculo de resultados con clasificación automática
- [x] Visualización de resultados por dimensión y dominio
- [x] Dashboard de resultados individuales y organizacionales
- [x] Generación de reportes PDF individuales y organizacionales
- [x] Desplegado en producción (DigitalOcean App Platform)
- [x] UX/navegación corregida para todos los roles
- [x] Corrección mapeo ítems-dimensiones según Tabla 23 oficial (Forma A, B, Extralaboral)
- [x] Implementación de ítems invertidos (Tablas 21, 22, 11)
- [x] Factores de transformación oficiales (Tablas 25, 26, 14)
- [x] Baremos duales extralaborales (Tabla 17 jefes / Tabla 18 auxiliares)
- [x] Baremos oficiales de estrés con puntuación ponderada (Tabla 4, Tabla 6)
- [x] Puntajes totales: intralaboral (Tabla 33), extralaboral, estrés

### Pendiente
- [ ] Tests unitarios y de integración
- [ ] Mejoras de diseño/estilos más refinados
- [ ] Exportación de datos a Excel/CSV
- [ ] Notificaciones por email a participantes
- [ ] Dashboard admin con métricas del sistema

## REFERENCIAS

- **Documento oficial**: https://dtalero78.github.io/bsl-presentacion/todos-brs-unificado.html
- **Marco legal**: Resolución 2646 de 2008
- **Validación**: Pontificia Universidad Javeriana - Ministerio de la Protección Social
