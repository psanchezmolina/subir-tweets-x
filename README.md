# Tweet Scheduler - Programador Automático de Tweets

Aplicación web para programar y publicar tweets automáticamente en X (Twitter) usando la API v2. Soporta threads, imágenes y tiene control de límites API (100 posts/mes en tier gratuito).

## 🚀 Características

- ✅ **Subida masiva de tweets** desde CSV/Excel
- ✅ **Programación automática** con cron job (cada 15 minutos)
- ✅ **Gestión de threads** - publicación secuencial con reply_to
- ✅ **Soporte de imágenes** desde URLs
- ✅ **Contador de API** - tracking de 100 llamadas/mes
- ✅ **Dashboard con estadísticas** en tiempo real
- ✅ **Autenticación básica** para proteger el acceso

## 📋 Stack Tecnológico

- **Backend:** Node.js 18 + Express 4
- **Base de Datos:** PostgreSQL (Supabase)
- **Scheduling:** node-cron
- **Frontend:** HTML5 + Vanilla JS + Bootstrap 5
- **Deployment:** Docker + Easypanel (VPS)

## 🛠️ Instalación Local

### 1. Prerequisitos

- Node.js 18+
- Cuenta de Supabase (https://supabase.com)
- Credenciales de X API Developer (https://developer.x.com)

### 2. Clonar Proyecto

```bash
cd subir-tweets-x
npm install
```

### 3. Configurar Supabase

1. Crear proyecto en https://supabase.com
2. Ir a SQL Editor
3. Ejecutar el script `scripts/setup-supabase.sql` completo
4. Copiar URL y Service Key (Settings > API)

### 4. Configurar Variables de Entorno

```bash
cp .env.example .env
```

Editar `.env`:

```bash
PORT=3000
NODE_ENV=development
SESSION_SECRET=cambiar_por_string_aleatorio_largo
ADMIN_PASSWORD=$2b$10$... # Ver sección de generación abajo

SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=tu_service_role_key_aqui
```

#### Generar ADMIN_PASSWORD hasheado:

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('TU_PASSWORD_AQUI', 10, (err, hash) => console.log(hash))"
```

### 5. Ejecutar Aplicación

```bash
npm start
```

Abrir: http://localhost:3000

## 📝 Formato CSV

El archivo CSV/Excel debe tener estas columnas:

| texto | thread_id | fecha_publicacion | imagen_url |
|-------|-----------|-------------------|------------|
| Tweet individual | | 2025-12-25 14:30 | |
| Primer tweet | hilo1 | 2025-12-25 15:00 | https://ejemplo.com/img.jpg |
| Segundo tweet | hilo1 | 2025-12-25 15:00 | |

**Columnas:**
- `texto` - Contenido del tweet (obligatorio, máx 280 caracteres)
- `thread_id` - Agrupa tweets en threads (opcional, vacío = individual)
- `fecha_publicacion` - Formato: `YYYY-MM-DD HH:MM` (obligatorio)
- `imagen_url` - URL de imagen HTTPS (opcional)

Ver `CSV_TEMPLATE.csv` para ejemplo completo.

## 🔧 Configuración de X API

### Obtener Credenciales

1. Ir a https://developer.x.com
2. Crear cuenta Developer (si no tienes)
3. Crear nuevo proyecto y app
4. En "User authentication settings":
   - Type: OAuth 1.0a
   - App permissions: **Read and Write**
5. En "Keys and Tokens":
   - Generar API Key + API Secret
   - Generar Access Token + Access Token Secret
6. Copiar las 4 credenciales en Settings de la app

## 📊 Límites de X API Free Tier

- **100 posts/mes** (writes) - LÍMITE CRÍTICO
- **17 tweets/día** (estimado, no documentado oficialmente)

La aplicación valida ambos límites antes de publicar.

## 🐳 Deployment en Easypanel

### 1. Crear Dockerfile (ya incluido)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN mkdir -p uploads
EXPOSE 3000
CMD ["node", "server.js"]
```

### 2. Push a GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/subir-tweets-x.git
git push -u origin main
```

### 3. Configurar en Easypanel

1. Login en Easypanel
2. Crear nuevo proyecto "tweet-scheduler"
3. Source: GitHub repository
4. Build: Docker
5. Port: 3000
6. Environment variables: Agregar todas de `.env`
7. Deploy

## 🔍 API Endpoints

### Autenticación

- `POST /api/auth/login` - Login con password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Verificar sesión

### Dashboard

- `GET /api/dashboard/stats` - Estadísticas completas

### Settings

- `POST /api/settings/credentials` - Guardar credenciales X API
- `GET /api/settings/credentials` - Ver credenciales (parciales)
- `POST /api/settings/test-connection` - Probar conexión

### Upload

- `POST /api/upload` - Subir CSV/Excel
- `POST /api/upload/test` - Validar archivo sin guardar

### Tweets

- `GET /api/tweets` - Listar tweets (con filtros)
- `GET /api/tweets/stats` - Estadísticas de tweets
- `GET /api/tweets/:id` - Obtener tweet específico

## 📁 Estructura del Proyecto

```
subir-tweets-x/
├── config/
│   └── supabase.js          # Cliente y CRUD de Supabase
├── modules/
│   ├── auth.js              # Autenticación
│   ├── twitterClient.js     # Cliente X API
│   ├── fileParser.js        # Parser CSV/Excel
│   ├── mediaUploader.js     # Upload de imágenes
│   ├── apiCounter.js        # Contador de API
│   └── tweetScheduler.js    # Scheduler principal
├── routes/
│   ├── dashboard.js         # Estadísticas
│   ├── settings.js          # Configuración
│   ├── upload.js            # Subida de archivos
│   └── tweets.js            # Gestión de tweets
├── public/
│   ├── index.html           # Frontend
│   ├── js/app.js            # Lógica JS
│   └── css/styles.css       # Estilos
├── scripts/
│   └── setup-supabase.sql   # Schema de DB
├── server.js                # Servidor principal
├── package.json
├── Dockerfile
└── .env.example
```

## 🔨 Desarrollo

### Ejecutar en modo desarrollo

```bash
npm run dev
```

### Testing del scheduler

Para probar el scheduler más frecuentemente, cambiar en `.env`:

```bash
CRON_SCHEDULE=* * * * *  # Cada minuto (solo para testing)
```

### Ver logs

```bash
# En producción (Easypanel)
Ver logs en el panel de Easypanel

# Local
Los logs aparecen en la consola donde ejecutaste npm start
```

## 🐛 Troubleshooting

### Error: "Límite mensual alcanzado"

- Has usado 100 posts este mes
- Esperar hasta próximo mes o upgrade a tier de pago

### Error: "Credenciales inválidas"

- Verificar en X Developer Portal que:
  - Las credenciales estén activas
  - La app tenga permisos **Read and Write**
  - El Access Token no haya expirado

### Tweets no se publican

- Verificar que cron job esté corriendo (ver logs)
- Verificar fechas programadas (deben ser futuras o muy recientes)
- Revisar tabla `logs` en Supabase para errores

### Error al subir CSV

- Formato de columnas: `texto, thread_id, fecha_publicacion, imagen_url`
- Fechas en formato: `YYYY-MM-DD HH:MM`
- Textos máximo 280 caracteres

## 🎯 TODO - Pasos Finales de Implementación

**IMPORTANTE:** El backend está 100% completo. Falta completar el frontend:

### 1. Completar Frontend (30-60 min)

#### A. `public/index.html`

Crear HTML con:
- Header con navbar (logo, logout button)
- Dashboard section (estadísticas, contador API, últimos tweets)
- Settings section (formulario credenciales X API)
- Upload section (drag & drop de CSV/Excel, preview)
- Tweets section (tabla con filtros: pending/published/failed)
- Login modal

Usar Bootstrap 5 desde CDN:

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
```

#### B. `public/js/app.js`

Implementar funciones:
- `checkAuth()` - Verificar si está autenticado
- `login(password)` - Login
- `logout()` - Logout
- `loadDashboard()` - Cargar estadísticas
- `loadCredentials()` - Cargar credenciales guardadas
- `saveCredentials(form)` - Guardar credenciales
- `testConnection()` - Probar conexión X API
- `uploadFile(file)` - Subir CSV/Excel
- `loadTweets(filters)` - Cargar tweets con filtros
- Routing simple con hash (#dashboard, #settings, #upload, #tweets)

#### C. `public/css/styles.css`

Estilos básicos:
- Variables CSS para colores
- Estilos para progress bar del contador API
- Estados de alerts (success/warning/danger)
- Tabla responsive
- Loading spinners

### 2. Crear archivos restantes (15 min)

```bash
# CSV_TEMPLATE.csv
touch CSV_TEMPLATE.csv
# Agregar ejemplo con 5-10 tweets de ejemplo

# Dockerfile (ya existe en el código)

# .dockerignore
echo "node_modules\n.env\n*.log\nuploads/*" > .dockerignore
```

### 3. Testing Local (30 min)

1. Crear proyecto en Supabase
2. Ejecutar SQL setup
3. Configurar .env con tus credenciales
4. `npm start`
5. Abrir http://localhost:3000
6. Login con password configurado
7. Configurar credenciales X API
8. Subir CSV de prueba
9. Ver que se guarden en Supabase
10. Modificar fecha de un tweet a "ahora" en Supabase
11. Esperar a que cron ejecute (o forzar con scheduler.run())

### 4. Deployment (45 min)

Seguir pasos de sección "🐳 Deployment en Easypanel"

## 📄 Licencia

MIT License

## 🤝 Contribuciones

Este es un proyecto personal pero acepta mejoras vía Pull Requests.

## 📧 Contacto

Para bugs o preguntas: GitHub Issues

---

**Versión:** 1.0.0
**Última actualización:** Diciembre 2025
**Autor:** [Tu nombre]
