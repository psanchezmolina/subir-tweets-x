# CLAUDE.md - Documentación Técnica para IA

> Guía completa del proyecto Tweet Scheduler para asistentes de IA (Claude, GPT, etc.)

## Índice

1. [Descripción General](#descripción-general)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Estructura de Archivos](#estructura-de-archivos)
5. [Base de Datos (Supabase)](#base-de-datos-supabase)
6. [Módulos Principales](#módulos-principales)
7. [Rutas y API Endpoints](#rutas-y-api-endpoints)
8. [Flujos de Trabajo](#flujos-de-trabajo)
9. [Configuración y Variables de Entorno](#configuración-y-variables-de-entorno)
10. [Limitaciones y Consideraciones](#limitaciones-y-consideraciones)
11. [Guías para Extender el Proyecto](#guías-para-extender-el-proyecto)
12. [Debugging y Troubleshooting](#debugging-y-troubleshooting)

---

## Descripción General

### ¿Qué es este proyecto?

Tweet Scheduler es una aplicación web full-stack que permite **programar y publicar tweets automáticamente** en X (Twitter) a través de su API v2. Está diseñado para funcionar con el tier gratuito de X API (100 posts/mes).

### Características principales

- **Subida masiva**: Soporta CSV y Excel para cargar múltiples tweets
- **Threads inteligentes**: Agrupa tweets por `thread_id` y los publica secuencialmente con `reply_to`
- **Scheduler automático**: Cron job que ejecuta cada 15 minutos (configurable)
- **Imágenes**: Descarga y sube imágenes desde URLs públicas
- **Contador API**: Tracking de llamadas mensuales y diarias para respetar límites
- **Dashboard en tiempo real**: Estadísticas, próximos tweets, últimas publicaciones
- **Autenticación**: Sistema de login con bcrypt para proteger acceso

### Caso de uso típico

1. Usuario carga un CSV con 50 tweets programados para las próximas semanas
2. El sistema valida y guarda en Supabase
3. Cada 15 minutos, el cron job busca tweets pendientes
4. Publica automáticamente los que llegaron a su hora programada
5. Actualiza estadísticas y contador API en tiempo real

---

## Stack Tecnológico

### Backend

```json
{
  "runtime": "Node.js 18+",
  "framework": "Express 5.2.1",
  "database": "PostgreSQL (via Supabase)",
  "scheduler": "node-cron 4.2.1",
  "auth": "express-session + bcrypt 6.0.0",
  "security": "helmet 8.1.0 + express-rate-limit 8.2.1",
  "apis": {
    "twitter": "twitter-api-v2 1.28.0",
    "supabase": "@supabase/supabase-js 2.88.0"
  }
}
```

### Procesamiento de archivos

```json
{
  "csv": "papaparse 5.5.3",
  "excel": "xlsx 0.18.5",
  "upload": "multer 2.0.2",
  "http": "axios 1.13.2"
}
```

### Frontend

```json
{
  "framework": "Vanilla JavaScript (ES6+)",
  "ui": "Bootstrap 5.3.0 (CDN)",
  "http": "Fetch API nativa"
}
```

### Deployment

```json
{
  "container": "Docker (Node 18 Alpine)",
  "hosting": "Easypanel (VPS)",
  "database": "Supabase Cloud"
}
```

---

## Arquitectura del Sistema

### Diagrama de alto nivel

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  (public/index.html + js/app.js + css/styles.css)          │
│                                                              │
│  Login → Dashboard → Settings → Upload → Tweets List       │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP/JSON
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER                            │
│                    (server.js)                               │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Session    │  │   Helmet     │  │ Rate Limiter │     │
│  │ Middleware   │  │  (Security)  │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              RUTAS PROTEGIDAS                         │  │
│  │  /api/auth/*    /api/dashboard/*   /api/settings/*  │  │
│  │  /api/upload/*  /api/tweets/*                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────┬──────────────────────────┬────────────────────────┘
          │                          │
          ▼                          ▼
┌─────────────────────┐    ┌─────────────────────┐
│      MÓDULOS        │    │    CRON JOB         │
│                     │    │  (cada 15 min)      │
│ • auth.js           │    │                     │
│ • twitterClient.js  │◄───┤  tweetScheduler.js  │
│ • fileParser.js     │    │                     │
│ • mediaUploader.js  │    │  1. Fetch pending   │
│ • apiCounter.js     │    │  2. Group threads   │
└─────────┬───────────┘    │  3. Publish tweets  │
          │                │  4. Update DB       │
          ▼                └──────────┬──────────┘
┌─────────────────────┐              │
│    SUPABASE DB      │◄─────────────┘
│                     │
│ • tweets            │
│ • credentials       │
│ • api_counter       │
│ • logs              │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│     X API v2        │
│                     │
│ • POST tweet        │
│ • Upload media      │
│ • Verify creds      │
└─────────────────────┘
```

### Flujo de datos principal

1. **Usuario sube CSV** → `routes/upload.js` → `fileParser.js` → `supabase.createTweets()`
2. **Cron se ejecuta** → `tweetScheduler.js` → `supabase.getTweetsDueForPublishing()`
3. **Publicación** → `twitterClient.js` → X API v2 → `supabase.updateTweetStatus()`
4. **Dashboard actualiza** → `routes/dashboard.js` → `supabase.getDashboardStats()` → Frontend

---

## Estructura de Archivos

```
subir-tweets-x/
│
├── server.js                    # PUNTO DE ENTRADA - Servidor Express
│
├── config/
│   └── supabase.js             # Cliente Supabase + todas las funciones CRUD
│
├── modules/
│   ├── auth.js                 # Middlewares de autenticación (login/logout/requireAuth)
│   ├── twitterClient.js        # Wrapper de twitter-api-v2 (postTweet, uploadImage)
│   ├── fileParser.js           # Parser CSV/Excel → JSON validado
│   ├── mediaUploader.js        # Descarga URLs y sube a X API
│   ├── apiCounter.js           # Lógica de contador mensual/diario
│   └── tweetScheduler.js       # ⭐ CORE - Lógica del cron job
│
├── routes/
│   ├── dashboard.js            # GET /api/dashboard/stats
│   ├── settings.js             # POST/GET /api/settings/credentials
│   ├── upload.js               # POST /api/upload (CSV/Excel)
│   └── tweets.js               # GET /api/tweets (con filtros)
│
├── public/                     # Frontend estático
│   ├── index.html              # SPA principal
│   ├── js/
│   │   └── app.js              # Lógica JS (routing, fetch API)
│   └── css/
│       └── styles.css          # Estilos personalizados
│
├── scripts/
│   └── setup-supabase.sql      # ⚠️ IMPORTANTE - Schema de DB
│
├── uploads/                    # Directorio temporal para archivos subidos
│
├── .env                        # Variables de entorno (NO COMMITAR)
├── .env.example                # Plantilla de .env
├── package.json                # Dependencias npm
├── Dockerfile                  # Container para deployment
├── CSV_TEMPLATE.csv            # Plantilla de ejemplo
│
├── README.md                   # Documentación para usuarios
├── QUICKSTART.md               # Guía rápida de setup
└── CLAUDE.md                   # 📄 ESTE ARCHIVO - Documentación técnica
```

### Archivos clave por función

| Función                  | Archivos involucrados                                          |
|--------------------------|----------------------------------------------------------------|
| **Autenticación**        | `modules/auth.js`, `server.js` (session config)                |
| **Subida de tweets**     | `routes/upload.js`, `modules/fileParser.js`                    |
| **Publicación auto**     | `modules/tweetScheduler.js`, `modules/twitterClient.js`        |
| **Base de datos**        | `config/supabase.js`, `scripts/setup-supabase.sql`             |
| **Contador API**         | `modules/apiCounter.js`, tabla `api_counter`                   |
| **Frontend**             | `public/index.html`, `public/js/app.js`                        |

---

## Base de Datos (Supabase)

### Schema SQL

Ver archivo completo: `scripts/setup-supabase.sql`

### Tabla: `tweets`

**Propósito:** Almacena todos los tweets programados y su estado.

| Columna              | Tipo        | Descripción                                        |
|----------------------|-------------|----------------------------------------------------|
| `id`                 | UUID (PK)   | Identificador único                                |
| `texto`              | TEXT        | Contenido del tweet (máx 280 chars validado)       |
| `thread_id`          | TEXT        | Agrupa tweets en threads (null = individual)       |
| `fecha_publicacion`  | TIMESTAMPTZ | Hora programada UTC                                |
| `imagen_url`         | TEXT        | URL pública de imagen (opcional)                   |
| `estado`             | TEXT        | `'pending'` \| `'published'` \| `'failed'`         |
| `tweet_id`           | TEXT        | ID retornado por X API (null hasta publicado)      |
| `error_message`      | TEXT        | Mensaje de error si falló                          |
| `published_at`       | TIMESTAMPTZ | Hora real de publicación                           |
| `created_at`         | TIMESTAMPTZ | Hora de creación en BD                             |
| `updated_at`         | TIMESTAMPTZ | Última actualización                               |

**Índices:**
- `idx_tweets_estado` en `estado`
- `idx_tweets_fecha_publicacion` en `fecha_publicacion`
- `idx_tweets_thread_id` en `thread_id`

### Tabla: `credentials`

**Propósito:** Almacena credenciales de X API (encriptadas en tránsito por HTTPS).

| Columna                 | Tipo        | Descripción                         |
|-------------------------|-------------|-------------------------------------|
| `id`                    | UUID (PK)   | Identificador único                 |
| `api_key`               | TEXT        | Consumer Key de X API               |
| `api_secret`            | TEXT        | Consumer Secret de X API            |
| `access_token`          | TEXT        | Access Token de X API               |
| `access_token_secret`   | TEXT        | Access Token Secret de X API        |
| `is_active`             | BOOLEAN     | Solo hay 1 fila con `true`          |
| `created_at`            | TIMESTAMPTZ | Hora de creación                    |
| `updated_at`            | TIMESTAMPTZ | Última actualización                |

**Nota de seguridad:** En producción real, deberías usar Supabase Vault para encriptar estos campos.

### Tabla: `api_counter`

**Propósito:** Tracking de llamadas API mensuales y diarias.

| Columna        | Tipo        | Descripción                                      |
|----------------|-------------|--------------------------------------------------|
| `id`           | UUID (PK)   | Identificador único                              |
| `month`        | TEXT        | Mes en formato `YYYY-MM`                         |
| `calls_count`  | INTEGER     | Total de llamadas este mes                       |
| `daily_counts` | JSONB       | `{ "2025-01-15": 5, "2025-01-16": 3 }`           |
| `created_at`   | TIMESTAMPTZ | Hora de creación                                 |
| `updated_at`   | TIMESTAMPTZ | Última actualización                             |

**Índice:**
- `idx_api_counter_month` en `month` (UNIQUE)

### Tabla: `logs`

**Propósito:** Registro de eventos del sistema.

| Columna      | Tipo        | Descripción                                 |
|--------------|-------------|---------------------------------------------|
| `id`         | UUID (PK)   | Identificador único                         |
| `level`      | TEXT        | `'info'` \| `'warning'` \| `'error'`        |
| `message`    | TEXT        | Mensaje descriptivo                         |
| `context`    | JSONB       | Datos adicionales (stack traces, etc.)      |
| `created_at` | TIMESTAMPTZ | Hora del evento                             |

**Índice:**
- `idx_logs_created_at` en `created_at`
- `idx_logs_level` en `level`

### Funciones CRUD disponibles

En `config/supabase.js`:

```javascript
// Tweets
createTweets(tweetsData)
getTweetsDueForPublishing()
getTweets(filters)
updateTweetStatus(tweetId, estado, xTweetId, errorMessage)
getTweetsPublishedToday()
getDashboardStats()

// Credentials
saveCredentials(credentials)
getCredentials()

// API Counter
getOrCreateCounter()
incrementApiCounter()
canMakeApiCall()

// Logs
createLog(level, message, context)
getLogs(filters)
```

---

## Módulos Principales

### 1. `server.js`

**Función:** Punto de entrada de la aplicación.

**Responsabilidades:**
- Configurar Express con middlewares (helmet, CORS, rate limiting)
- Configurar sesiones con `express-session`
- Registrar rutas protegidas con `auth.requireAuth`
- Configurar cron job con `node-cron`
- Servir archivos estáticos del frontend
- Manejo global de errores

**Configuración importante:**

```javascript
// Cron ejecuta cada 15 min (configurable con CRON_SCHEDULE)
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/15 * * * *';

cron.schedule(CRON_SCHEDULE, async () => {
  await scheduler.run();
});
```

**Rate limiting:**
- `/api/*` → 100 requests por 15 minutos
- `/api/upload` → 10 uploads por hora

---

### 2. `modules/auth.js`

**Función:** Autenticación y autorización.

**Middlewares exportados:**

```javascript
login(req, res)           // POST /api/auth/login
logout(req, res)          // POST /api/auth/logout
checkAuth(req, res)       // GET /api/auth/status
requireAuth(req, res, next)  // Proteger rutas
```

**Flujo de login:**

1. Usuario envía `{ password }` en POST
2. Compara con `process.env.ADMIN_PASSWORD` usando `bcrypt.compare()`
3. Si correcto → `req.session.authenticated = true`
4. Devuelve `{ success: true }`

**Seguridad:**
- Usa bcrypt para hash de contraseña
- Cookie httpOnly y secure en producción
- Sesión expira en 24 horas

---

### 3. `modules/tweetScheduler.js` ⭐

**Función:** Lógica principal del scheduler (ejecutada por cron).

**Flujo completo:**

```javascript
async run() {
  // 1. Verificar credenciales existan
  const credentials = await db.getCredentials();
  if (!credentials) return;

  // 2. Obtener tweets pendientes
  const pendingTweets = await db.getTweetsDueForPublishing();
  if (pendingTweets.length === 0) return;

  // 3. Verificar límites API
  const limitCheck = await apiCounter.canMakeCall();
  if (!limitCheck.allowed) return;

  // 4. Inicializar cliente Twitter
  const twitterClient = new TwitterClient(credentials);
  const mediaUploader = new MediaUploader(twitterClient);

  // 5. Agrupar por thread_id
  const threads = this.groupByThread(pendingTweets);

  // 6. Publicar secuencialmente
  await this.publishThreads(threads, twitterClient, mediaUploader);
}
```

**Lógica de threads:**

```javascript
groupByThread(tweets) {
  // Agrupa por thread_id o crea clave única para individuales
  const threads = {};

  tweets.forEach(tweet => {
    const key = tweet.thread_id || `single_${tweet.id}`;
    if (!threads[key]) threads[key] = [];
    threads[key].push(tweet);
  });

  // Ordena tweets dentro de cada thread por fecha
  Object.keys(threads).forEach(key => {
    threads[key].sort((a, b) =>
      new Date(a.fecha_publicacion) - new Date(b.fecha_publicacion)
    );
  });

  return threads;
}
```

**Delays importantes:**
- 2 segundos entre tweets del mismo thread
- 5 segundos entre threads diferentes
- Previene rate limiting de X API

**Manejo de errores:**
- Si un tweet falla en un thread → aborta resto del thread
- Si un tweet individual falla → continúa con el siguiente
- Todos los errores se guardan en `tweets.error_message` y tabla `logs`

---

### 4. `modules/twitterClient.js`

**Función:** Wrapper de `twitter-api-v2` para interactuar con X API.

**Métodos principales:**

```javascript
class TwitterClient {
  constructor(credentials) {
    // Inicializa TwitterApi con OAuth 1.0a
    this.client = new TwitterApi({
      appKey: credentials.api_key,
      appSecret: credentials.api_secret,
      accessToken: credentials.access_token,
      accessSecret: credentials.access_token_secret,
    });
    this.rwClient = this.client.readWrite;
  }

  async postTweet({ text, reply_to, media_ids }) {
    // Validaciones: texto no vacío, max 280 chars
    // Construye payload con reply_to y media
    // Retorna ID del tweet publicado
  }

  async uploadImage(imageBuffer, mimeType) {
    // Valida tamaño (max 5MB)
    // Sube a v1.1 API (media endpoint)
    // Retorna mediaId
  }

  async testConnection() {
    // Llama a v2.me() para verificar credenciales
    // Retorna { success, user: { id, name, username } }
  }
}
```

**Errores específicos de X API:**

| Código | Significado                                        |
|--------|----------------------------------------------------|
| 401    | Credenciales inválidas                             |
| 403    | Permisos insuficientes (requiere Read and Write)   |
| 429    | Rate limit excedido                                |

---

### 5. `modules/fileParser.js`

**Función:** Parsear CSV/Excel y validar formato.

**Flujo:**

```javascript
async parseFile(filePath) {
  // 1. Detectar tipo de archivo (.csv o .xlsx)
  // 2. Parsear usando papaparse o xlsx
  // 3. Validar columnas requeridas: texto, fecha_publicacion
  // 4. Validar cada fila:
  //    - texto no vacío y <= 280 chars
  //    - fecha_publicacion en formato correcto
  //    - imagen_url es HTTPS válida (si existe)
  // 5. Retornar array de objetos validados
}
```

**Formato esperado:**

| texto           | thread_id | fecha_publicacion | imagen_url                |
|-----------------|-----------|-------------------|---------------------------|
| Mi primer tweet | hilo1     | 2025-12-25 14:30  | https://example.com/1.jpg |
| Segundo tweet   | hilo1     | 2025-12-25 14:30  |                           |

**Validaciones:**
- `texto` → obligatorio, max 280 chars
- `thread_id` → opcional, string
- `fecha_publicacion` → obligatorio, formato `YYYY-MM-DD HH:MM`
- `imagen_url` → opcional, debe ser HTTPS válida

---

### 6. `modules/apiCounter.js`

**Función:** Gestionar límites de API de X (100 posts/mes, ~17/día).

**Métodos:**

```javascript
async canMakeCall() {
  // Verifica límite mensual (100) y diario (~17)
  // Retorna { allowed: boolean, reason: string }
}

async increment() {
  // Incrementa contador mensual y diario
  // Actualiza tabla api_counter
}

async getInfo() {
  // Retorna estadísticas para dashboard
  // { month, calls_count, monthly_limit, remaining, percentage, is_warning, is_critical }
}

async reset() {
  // Resetea contador (útil para testing)
}
```

**Lógica de límites:**

```javascript
const MONTHLY_LIMIT = 100;
const DAILY_LIMIT = 17;

const canMakeCall = async () => {
  const counter = await db.getOrCreateCounter();
  const today = new Date().toISOString().slice(0, 10);

  // Verificar límite mensual
  if (counter.calls_count >= MONTHLY_LIMIT) {
    return { allowed: false, reason: 'Límite mensual alcanzado (100 posts)' };
  }

  // Verificar límite diario
  const dailyCount = counter.daily_counts[today] || 0;
  if (dailyCount >= DAILY_LIMIT) {
    return { allowed: false, reason: 'Límite diario alcanzado (17 posts)' };
  }

  return { allowed: true };
};
```

---

### 7. `modules/mediaUploader.js`

**Función:** Descargar imágenes desde URLs y subirlas a X API.

**Flujo:**

```javascript
async upload(imageUrl) {
  // 1. Validar que sea HTTPS
  // 2. Descargar imagen con axios (responseType: 'arraybuffer')
  // 3. Detectar MIME type del Content-Type header
  // 4. Validar tamaño (max 5MB)
  // 5. Subir a X API usando twitterClient.uploadImage()
  // 6. Retornar mediaId
}
```

**Tipos de imagen soportados:**
- JPEG
- PNG
- GIF
- WEBP

**Límites:**
- Tamaño máximo: 5MB
- Solo URLs HTTPS

---

## Rutas y API Endpoints

### Autenticación (sin protección)

#### `POST /api/auth/login`

**Body:**
```json
{ "password": "tu_password_aqui" }
```

**Response (éxito):**
```json
{ "success": true }
```

**Response (error):**
```json
{ "success": false, "error": "Contraseña incorrecta" }
```

#### `POST /api/auth/logout`

**Response:**
```json
{ "success": true }
```

#### `GET /api/auth/status`

**Response (autenticado):**
```json
{ "authenticated": true }
```

**Response (no autenticado):**
```json
{ "authenticated": false }
```

---

### Dashboard (protegido con `requireAuth`)

#### `GET /api/dashboard/stats`

**Response:**
```json
{
  "success": true,
  "stats": {
    "pendingCount": 45,
    "publishedToday": 3,
    "nextScheduled": "2025-12-25T14:30:00.000Z",
    "recentTweets": [
      {
        "id": "uuid-1",
        "texto": "Mi tweet publicado",
        "estado": "published",
        "tweet_id": "1234567890",
        "published_at": "2025-12-24T10:15:00.000Z"
      }
    ],
    "apiCalls": {
      "month": "2025-12",
      "calls_count": 23,
      "monthly_limit": 100,
      "remaining": 77,
      "percentage": 23,
      "is_warning": false,
      "is_critical": false
    },
    "scheduler": {
      "isRunning": false,
      "lastRun": "2025-12-24T10:00:00.000Z"
    }
  }
}
```

---

### Settings (protegido)

#### `POST /api/settings/credentials`

**Body:**
```json
{
  "api_key": "xxxxx",
  "api_secret": "xxxxx",
  "access_token": "xxxxx",
  "access_token_secret": "xxxxx"
}
```

**Response:**
```json
{ "success": true }
```

#### `GET /api/settings/credentials`

**Response:**
```json
{
  "success": true,
  "credentials": {
    "api_key": "xxx***xxx",
    "api_secret": "xxx***xxx",
    "access_token": "xxx***xxx",
    "access_token_secret": "xxx***xxx",
    "hasCredentials": true
  }
}
```

**Nota:** Las credenciales se devuelven parcialmente ocultas por seguridad.

#### `POST /api/settings/test-connection`

**Response (éxito):**
```json
{
  "success": true,
  "user": {
    "id": "123456789",
    "name": "Mi Cuenta",
    "username": "micuenta"
  }
}
```

**Response (error):**
```json
{
  "success": false,
  "error": "Credenciales inválidas - verifica tu API Key y Access Token"
}
```

---

### Upload (protegido)

#### `POST /api/upload`

**Content-Type:** `multipart/form-data`

**Form fields:**
- `file` → Archivo CSV o Excel

**Response (éxito):**
```json
{
  "success": true,
  "count": 50,
  "message": "50 tweets guardados exitosamente"
}
```

**Response (error validación):**
```json
{
  "success": false,
  "error": "Fila 3: El campo 'texto' no puede estar vacío"
}
```

#### `POST /api/upload/test`

Igual que `/api/upload` pero NO guarda en BD. Útil para validar archivo antes de subir.

---

### Tweets (protegido)

#### `GET /api/tweets`

**Query params:**
- `estado` → `'pending'` | `'published'` | `'failed'` (opcional)
- `limit` → número de tweets a retornar (default: 50)
- `offset` → para paginación (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "texto": "Mi tweet",
      "thread_id": null,
      "fecha_publicacion": "2025-12-25T14:30:00.000Z",
      "imagen_url": null,
      "estado": "pending",
      "tweet_id": null,
      "error_message": null,
      "published_at": null,
      "created_at": "2025-12-24T10:00:00.000Z",
      "updated_at": "2025-12-24T10:00:00.000Z"
    }
  ],
  "count": 100,
  "total": 100
}
```

#### `GET /api/tweets/stats`

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 100,
    "pending": 45,
    "published": 50,
    "failed": 5
  }
}
```

#### `GET /api/tweets/:id`

**Response:**
```json
{
  "success": true,
  "tweet": {
    "id": "uuid-1",
    "texto": "Mi tweet",
    ...
  }
}
```

---

## Flujos de Trabajo

### Flujo 1: Subida de CSV/Excel

```
Usuario selecciona archivo
    ↓
POST /api/upload (multipart/form-data)
    ↓
Multer guarda archivo en /uploads
    ↓
fileParser.parseFile(path)
    ↓
Validaciones:
  - Columnas requeridas existen
  - Cada fila tiene texto y fecha válidos
  - Fechas en formato correcto
  - Imágenes son URLs HTTPS
    ↓
db.createTweets(tweetsData)
    ↓
Supabase inserta en tabla tweets
    ↓
Response: { success: true, count: 50 }
    ↓
Frontend actualiza dashboard
```

### Flujo 2: Publicación Automática (Cron Job)

```
Cron se dispara (cada 15 min)
    ↓
tweetScheduler.run()
    ↓
1. Obtener credenciales activas
   db.getCredentials()
    ↓
2. Obtener tweets pendientes
   db.getTweetsDueForPublishing()
   WHERE estado = 'pending' AND fecha_publicacion <= NOW()
    ↓
3. Verificar límites
   apiCounter.canMakeCall()
   (100 mensual, 17 diario)
    ↓
4. Agrupar por thread_id
   groupByThread(tweets)
    ↓
5. Para cada thread:
   ┌─────────────────────────┐
   │ Para cada tweet:        │
   │   ↓                     │
   │ Verificar límite        │
   │   ↓                     │
   │ ¿Tiene imagen?          │
   │   ↓ Sí                  │
   │ mediaUploader.upload()  │
   │   ↓                     │
   │ twitterClient.postTweet │
   │   (con reply_to si      │
   │    es thread)           │
   │   ↓                     │
   │ db.updateTweetStatus    │
   │   estado = 'published'  │
   │   ↓                     │
   │ apiCounter.increment()  │
   │   ↓                     │
   │ Sleep 2 segundos        │
   └─────────────────────────┘
    ↓
Sleep 5 segundos entre threads
    ↓
Crear log de resultados
    ↓
Fin
```

### Flujo 3: Publicación de Thread

**Ejemplo:** 3 tweets con `thread_id = "hilo1"`

```
Tweet 1: "Hola, esto es un thread"
  ↓
twitterClient.postTweet({ text: "...", reply_to: null })
  ↓
X API retorna: tweet_id = "111"
  ↓
Sleep 2 segundos
  ↓
Tweet 2: "Segunda parte del thread"
  ↓
twitterClient.postTweet({
  text: "...",
  reply_to: "111"  ← Reply al anterior
})
  ↓
X API retorna: tweet_id = "222"
  ↓
Sleep 2 segundos
  ↓
Tweet 3: "Tercera parte"
  ↓
twitterClient.postTweet({
  text: "...",
  reply_to: "222"  ← Reply al anterior
})
  ↓
X API retorna: tweet_id = "333"
  ↓
Thread completo publicado
```

**Nota:** Si falla un tweet en medio del thread, se aborta el resto para mantener coherencia.

### Flujo 4: Dashboard en tiempo real

```
Usuario abre /dashboard
    ↓
Frontend: GET /api/dashboard/stats
    ↓
Backend:
  - db.getDashboardStats() → pending, published today, next scheduled
  - apiCounter.getInfo() → calls_count, remaining, percentage
  - scheduler.getStatus() → isRunning, lastRun
  - db.getTweets({ estado: 'published', limit: 10 }) → recent tweets
    ↓
Response JSON con todas las stats
    ↓
Frontend renderiza:
  - Cards con números grandes (pending, published today)
  - Progress bar del contador API
  - Lista de últimos tweets publicados
  - Próximo tweet programado
```

---

## Configuración y Variables de Entorno

### Archivo `.env`

```bash
# Servidor
PORT=3000
NODE_ENV=production  # 'development' o 'production'

# Sesión
SESSION_SECRET=string_aleatorio_muy_largo_y_seguro_cambiar_esto

# Autenticación
# Generar con: node -e "const bcrypt = require('bcrypt'); bcrypt.hash('TU_PASSWORD', 10, (err, hash) => console.log(hash))"
ADMIN_PASSWORD=$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Cron Job (opcional)
# Formato cron: minuto hora día mes día_semana
# Ejemplos:
#   */15 * * * *  → Cada 15 minutos (DEFAULT)
#   0 */2 * * *   → Cada 2 horas
#   * * * * *     → Cada minuto (solo para testing)
CRON_SCHEDULE=*/15 * * * *
```

### Variables críticas

| Variable             | Requerida | Descripción                                    |
|----------------------|-----------|------------------------------------------------|
| `SUPABASE_URL`       | ✅        | URL del proyecto Supabase                      |
| `SUPABASE_SERVICE_KEY` | ✅      | Service Role key (con permisos totales)        |
| `ADMIN_PASSWORD`     | ✅        | Hash bcrypt de la contraseña de admin          |
| `SESSION_SECRET`     | ✅        | String aleatorio para firmar cookies           |
| `PORT`               | ❌        | Puerto del servidor (default: 3000)            |
| `NODE_ENV`           | ❌        | Entorno (default: development)                 |
| `CRON_SCHEDULE`      | ❌        | Frecuencia del cron (default: cada 15 min)     |

### Cómo obtener variables de Supabase

1. Ir a https://supabase.com
2. Crear proyecto o abrir uno existente
3. Ir a **Settings** → **API**
4. Copiar:
   - **Project URL** → `SUPABASE_URL`
   - **Project API keys** → **service_role** → `SUPABASE_SERVICE_KEY`

### Cómo generar ADMIN_PASSWORD

```bash
# Opción 1: Usando Node.js
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('mipassword123', 10, (err, hash) => console.log(hash))"

# Opción 2: Online (solo para desarrollo, no usar en producción)
# https://bcrypt-generator.com/
```

---

## Limitaciones y Consideraciones

### Límites de X API (Free Tier)

| Límite                | Valor           | Implementación                          |
|-----------------------|-----------------|-----------------------------------------|
| Posts por mes         | 100             | Validado en `apiCounter.canMakeCall()`  |
| Posts por día         | ~17 (estimado)  | Validado en `apiCounter.canMakeCall()`  |
| Tamaño de imagen      | 5 MB            | Validado en `mediaUploader.upload()`    |
| Longitud de tweet     | 280 caracteres  | Validado en `fileParser` y `twitterClient` |

### Seguridad

**Implementado:**
- ✅ Helmet para headers de seguridad
- ✅ Rate limiting (100 req/15min general, 10 uploads/hora)
- ✅ HTTPS forzado en producción
- ✅ HttpOnly cookies
- ✅ Bcrypt para contraseñas
- ✅ Express-session con secrets

**Pendiente (para producción real):**
- ⚠️ Encriptar credenciales en Supabase (usar Vault)
- ⚠️ Implementar CSRF tokens
- ⚠️ Agregar validación de MIME type real de imágenes (no solo extensión)
- ⚠️ Sanitizar inputs para prevenir XSS
- ⚠️ Implementar 2FA para login

### Performance

**Optimizaciones implementadas:**
- Índices en BD para queries frecuentes
- Paginación en `/api/tweets`
- Rate limiting para prevenir abuse
- Delays entre publicaciones para evitar rate limits de X

**Posibles mejoras:**
- Cache de estadísticas del dashboard (Redis)
- Queue system para publicaciones (Bull/BullMQ)
- Compresión de responses con gzip
- CDN para archivos estáticos

### Escalabilidad

**Limitaciones actuales:**
- Sesiones en memoria (no persisten entre reinicios)
- Un solo worker (no clustering)
- Sin retry automático para tweets fallidos
- Sin notificaciones cuando se alcanza límite API

**Para escalar:**
1. Usar Redis para sesiones (express-session + connect-redis)
2. Implementar PM2 con cluster mode
3. Agregar queue system (Bull) para reintentos
4. Implementar webhooks/emails para notificaciones
5. Migrar a arquitectura serverless (AWS Lambda + SQS)

---

## Guías para Extender el Proyecto

### Agregar un nuevo endpoint API

**Ejemplo:** Endpoint para eliminar tweets pendientes

1. **Crear función en `config/supabase.js`:**

```javascript
async function deleteTweet(tweetId) {
  try {
    const { error } = await supabase
      .from('tweets')
      .delete()
      .eq('id', tweetId)
      .eq('estado', 'pending'); // Solo permitir borrar pendientes

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting tweet:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  // ... exports existentes
  deleteTweet
};
```

2. **Agregar ruta en `routes/tweets.js`:**

```javascript
const db = require('../config/supabase');

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.deleteTweet(id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Tweet eliminado'
    });
  } catch (error) {
    console.error('Error deleting tweet:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar tweet'
    });
  }
});
```

3. **Usar desde frontend:**

```javascript
async function deleteTweet(tweetId) {
  const response = await fetch(`/api/tweets/${tweetId}`, {
    method: 'DELETE'
  });

  const data = await response.json();

  if (data.success) {
    alert('Tweet eliminado');
    loadTweets(); // Recargar lista
  } else {
    alert('Error: ' + data.error);
  }
}
```

---

### Agregar soporte para videos

**Cambios necesarios:**

1. **Actualizar tabla `tweets`:**

```sql
ALTER TABLE tweets
ADD COLUMN video_url TEXT,
ADD COLUMN media_type TEXT DEFAULT 'none'; -- 'none', 'image', 'video'
```

2. **Actualizar `mediaUploader.js`:**

```javascript
async uploadVideo(videoUrl) {
  // 1. Descargar video
  // 2. Validar formato (MP4, MOV)
  // 3. Validar duración (max 140s en free tier)
  // 4. Subir usando client.v1.uploadMedia con type 'video'
  // 5. Wait for processing (poll status)
  // 6. Return mediaId
}
```

3. **Actualizar `tweetScheduler.js`:**

```javascript
// En publishThreads
if (tweet.media_type === 'image' && tweet.imagen_url) {
  mediaId = await mediaUploader.upload(tweet.imagen_url);
} else if (tweet.media_type === 'video' && tweet.video_url) {
  mediaId = await mediaUploader.uploadVideo(tweet.video_url);
}
```

4. **Actualizar CSV parser para validar campo `video_url`**

---

### Agregar multi-usuario

**Cambios necesarios:**

1. **Nueva tabla `users`:**

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

2. **Actualizar todas las tablas para asociar con usuario:**

```sql
ALTER TABLE tweets ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE credentials ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE api_counter ADD COLUMN user_id UUID REFERENCES users(id);
```

3. **Actualizar `auth.js` para login con email/password**

4. **Filtrar queries por `user_id` en todas las funciones de Supabase**

5. **Actualizar frontend para mostrar solo datos del usuario logueado**

---

### Agregar edición de tweets pendientes

**Pasos:**

1. **Endpoint PATCH `/api/tweets/:id`:**

```javascript
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { texto, fecha_publicacion, imagen_url } = req.body;

  // Validar que esté pendiente
  const tweet = await db.getTweetById(id);
  if (tweet.estado !== 'pending') {
    return res.status(400).json({
      success: false,
      error: 'Solo se pueden editar tweets pendientes'
    });
  }

  // Actualizar
  const result = await db.updateTweet(id, {
    texto,
    fecha_publicacion,
    imagen_url
  });

  res.json(result);
});
```

2. **Frontend: Modal de edición con formulario**

---

### Agregar notificaciones por email

**Cuando implementar:**
- Límite API alcanzado
- Tweet fallido
- Publicación exitosa

**Librería recomendada:** `nodemailer` o Supabase Edge Functions

**Ejemplo con Nodemailer:**

```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

async function sendNotification(subject, message) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.ADMIN_EMAIL,
    subject,
    text: message
  });
}

// Usar en tweetScheduler
if (!limitCheck.allowed) {
  await sendNotification(
    'Límite API alcanzado',
    `Se ha alcanzado el ${limitCheck.reason}`
  );
}
```

---

## Debugging y Troubleshooting

### Logs del servidor

**Producción (Easypanel):**
- Ver logs en el panel de Easypanel

**Local:**
- Los logs aparecen en la consola donde ejecutaste `npm start`

### Problemas comunes

#### 1. Tweets no se publican

**Posibles causas:**

| Problema                       | Cómo verificar                                  | Solución                                      |
|--------------------------------|------------------------------------------------|-----------------------------------------------|
| Credenciales inválidas         | POST `/api/settings/test-connection`           | Regenerar tokens en X Developer Portal        |
| Permisos insuficientes         | Error 403 en logs                              | Cambiar app a "Read and Write"                |
| Límite API alcanzado           | GET `/api/dashboard/stats` → apiCalls          | Esperar próximo mes o upgrade plan            |
| Fechas incorrectas             | Ver `tweets.fecha_publicacion` en Supabase     | Asegurar formato `YYYY-MM-DD HH:MM`           |
| Cron job no ejecuta            | Ver logs del servidor                          | Verificar `CRON_SCHEDULE` en `.env`           |

**Debug:**

```javascript
// En tweetScheduler.js, agregar logs adicionales
console.log('Pending tweets:', pendingTweets);
console.log('Limit check:', limitCheck);
console.log('Threads grouped:', threads);
```

#### 2. Error al subir CSV

**Posibles causas:**

| Error                                  | Causa                          | Solución                                |
|----------------------------------------|--------------------------------|-----------------------------------------|
| "El campo 'texto' no puede estar vacío" | Fila sin texto                 | Revisar CSV, llenar todas las filas     |
| "Formato de fecha inválido"            | Fecha mal formateada           | Usar formato `YYYY-MM-DD HH:MM`         |
| "URL de imagen inválida"               | URL no es HTTPS                | Cambiar a HTTPS o dejar campo vacío     |
| "El archivo excede el tamaño máximo"   | CSV > 5MB                      | Dividir en múltiples archivos           |

**Debug:**

```javascript
// En fileParser.js, agregar log de cada fila
console.log(`Parsing row ${index}:`, row);
```

#### 3. Imagen no se sube

**Posibles causas:**

| Problema                | Causa                               | Solución                                |
|-------------------------|-------------------------------------|-----------------------------------------|
| URL inaccesible         | Imagen detrás de login/paywall      | Usar URL pública                        |
| Formato no soportado    | Imagen en formato raro (TIFF, BMP)  | Convertir a JPG/PNG                     |
| Tamaño excedido         | Imagen > 5MB                        | Comprimir o redimensionar               |

**Debug:**

```javascript
// En mediaUploader.js
console.log('Downloading image from:', imageUrl);
console.log('Image buffer size:', imageBuffer.length);
console.log('MIME type:', mimeType);
```

#### 4. Sesión se pierde al recargar

**Causa:** Sesiones en memoria, no persisten entre reinicios.

**Solución (producción):**

1. Instalar `connect-redis`:
```bash
npm install connect-redis redis
```

2. Actualizar `server.js`:
```javascript
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL
});
redisClient.connect();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
```

#### 5. Rate limiting muy agresivo

**Problema:** No puedo hacer requests al API.

**Causa:** Límite de 100 req/15min alcanzado.

**Solución temporal:**

```javascript
// En server.js, aumentar límite (solo para desarrollo)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Aumentar de 100 a 1000
  message: '...'
});
```

---

### Queries útiles para debugging en Supabase

```sql
-- Ver tweets pendientes con fecha pasada
SELECT * FROM tweets
WHERE estado = 'pending'
  AND fecha_publicacion < NOW()
ORDER BY fecha_publicacion;

-- Ver tweets fallidos y sus errores
SELECT texto, error_message, created_at
FROM tweets
WHERE estado = 'failed'
ORDER BY created_at DESC;

-- Ver contador API actual
SELECT * FROM api_counter
WHERE month = TO_CHAR(NOW(), 'YYYY-MM');

-- Ver logs recientes
SELECT level, message, created_at
FROM logs
ORDER BY created_at DESC
LIMIT 50;

-- Estadísticas de estados de tweets
SELECT estado, COUNT(*)
FROM tweets
GROUP BY estado;

-- Resetear contador API (solo para testing)
UPDATE api_counter
SET calls_count = 0, daily_counts = '{}'
WHERE month = TO_CHAR(NOW(), 'YYYY-MM');
```

---

## Conclusión

Este documento cubre la arquitectura completa del proyecto Tweet Scheduler. Si necesitas modificar o extender funcionalidad:

1. **Lee primero** esta documentación para entender el flujo
2. **Identifica el módulo** que necesitas modificar (ver sección de Módulos)
3. **Sigue los patrones existentes** (manejo de errores, validaciones, etc.)
4. **Actualiza tests** si los hay
5. **Documenta cambios** en README.md y este archivo

**Archivos clave a revisar siempre:**
- `server.js` - Punto de entrada, configuración
- `config/supabase.js` - Interacción con BD
- `modules/tweetScheduler.js` - Lógica de publicación
- `scripts/setup-supabase.sql` - Schema de BD

**Recursos externos:**
- X API Docs: https://developer.x.com/en/docs/x-api
- twitter-api-v2 Docs: https://github.com/PLhery/node-twitter-api-v2
- Supabase Docs: https://supabase.com/docs
- node-cron Docs: https://github.com/node-cron/node-cron

---

**Última actualización:** Diciembre 2025
**Versión:** 1.0.0
**Mantenido por:** [Tu nombre]
