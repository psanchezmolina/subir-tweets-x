# 🚀 Quick Start Guide

## ✅ Pasos para ejecutar localmente (15 minutos)

### 1. Configurar Supabase (5 min)

```bash
# 1. Ir a https://supabase.com
# 2. Crear nueva organización (si no tienes)
# 3. Crear nuevo proyecto:
#    - Nombre: tweet-scheduler
#    - Database Password: [elige uno seguro]
#    - Region: [la más cercana a ti]

# 4. Esperar a que el proyecto se inicialice (~2 min)

# 5. En el proyecto, ir a SQL Editor (icono en sidebar)

# 6. Copiar TODO el contenido de scripts/setup-supabase.sql

# 7. Pegar en el editor y hacer click en RUN

# 8. Verificar que muestre: "4 tables created"

# 9. Ir a Settings > API
# 10. Copiar:
#     - Project URL
#     - service_role key (en "Project API keys" > service_role)
```

### 2. Configurar Variables de Entorno (2 min)

```bash
# Crear archivo .env en la raíz del proyecto
cp .env.example .env

# Editar .env con tus valores
```

Generar ADMIN_PASSWORD hasheado:
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('mipassword123', 10, (err, hash) => console.log(hash))"
```

Ejemplo de `.env`:
```bash
PORT=3000
NODE_ENV=development
SESSION_SECRET=mi_secreto_aleatorio_muy_largo_12345
ADMIN_PASSWORD=$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Ejecutar la Aplicación (1 min)

```bash
# Ya deberías tener node_modules instalado
# Si no: npm install

# Ejecutar
npm start

# Deberías ver:
# 🚀 Tweet Scheduler Server
# 🚀 URL: http://localhost:3000
```

### 4. Probar la Aplicación (5 min)

```bash
# 1. Abrir navegador: http://localhost:3000

# 2. Login con el password que configuraste

# 3. Ir a Settings

# 4. Configurar credenciales de X API:
#    - Ve a https://developer.x.com
#    - Crea un proyecto y app
#    - Genera las 4 credenciales (API Key, API Secret, Access Token, Access Token Secret)
#    - IMPORTANTE: Los permisos deben ser "Read and Write"
#    - Pega las credenciales en el formulario
#    - Click "Probar Conexión"

# 5. Si la conexión es exitosa, ir a "Subir CSV"

# 6. Usar CSV_TEMPLATE.csv (ya incluido) o crear el tuyo

# 7. Modificar fechas en el CSV para que sean cercanas (ej: dentro de 2 minutos)

# 8. Subir el archivo

# 9. Ir a Dashboard y ver que los tweets aparecen como "Pendientes"

# 10. Esperar a que el cron job ejecute (cada 15 minutos)
#     O forzar ejecución inmediata modificando en .env:
#     CRON_SCHEDULE=* * * * *  (cada minuto)
#     Y reiniciar el servidor
```

### 5. Verificar Publicación

```bash
# En los logs del servidor verás:
# 🚀 Iniciando scheduler de tweets...
# 📋 X tweets pendientes encontrados
# 📝 Publicando...
# ✓ Publicado exitosamente (ID: 1234567890)

# En la app:
# - Dashboard mostrará contador API actualizado
# - Tweets cambiarán a estado "Publicado"
# - Aparecerán en "Últimos Tweets Publicados"
```

## 🐛 Troubleshooting Rápido

### Error: "SUPABASE_URL no definida"
- Verificar que `.env` existe y tiene las variables correctas
- Reiniciar el servidor después de crear/modificar `.env`

### Error: "Credenciales inválidas" (X API)
- Verificar que la app tiene permisos "Read and Write"
- Regenerar Access Token y Access Token Secret
- Verificar que no haya espacios extra al copiar/pegar

### Tweets no se publican
- Verificar que las fechas en el CSV sean futuras o muy recientes
- Ver los logs del servidor para errores
- Verificar límites: 100 posts/mes, 17 posts/día

### No puedo hacer login
- Verificar que ADMIN_PASSWORD en `.env` es un hash válido
- Si usaste password plano (inseguro), la app lo aceptará temporalmente
- Para seguridad, generar hash con el comando bcrypt

## 📦 Deployment en Easypanel

### 1. Preparar Repositorio

```bash
# Inicializar Git (si no lo hiciste)
git init

# Agregar archivos
git add .

# Commit
git commit -m "Initial commit - Tweet Scheduler"

# Crear repo en GitHub y conectar
git remote add origin https://github.com/TU_USUARIO/tweet-scheduler.git
git branch -M main
git push -u origin main
```

### 2. Configurar en Easypanel

```
1. Login en tu Easypanel (Contabo VPS)
2. Click "New Project"
3. Source: GitHub
4. Repository: [seleccionar tu repo]
5. Build: Docker
6. Port: 3000
7. Environment Variables:
   - Agregar TODAS las de tu .env local
   - NODE_ENV=production
8. Click "Deploy"
9. Esperar deployment (~2-5 min)
10. Copiar la URL asignada
11. Acceder y probar
```

### 3. Configurar Dominio (Opcional)

```
En Easypanel:
1. Ir a tu proyecto > Settings > Domains
2. Agregar dominio personalizado
3. Configurar DNS en tu proveedor:
   - Tipo: A
   - Host: tweets (o @)
   - Value: [IP de tu VPS]
4. Esperar propagación DNS (~10 min)
```

## ✅ Checklist Final

- [ ] Supabase creado y SQL ejecutado
- [ ] .env configurado con todas las variables
- [ ] Servidor corriendo localmente sin errores
- [ ] Login funcionando
- [ ] Credenciales X API guardadas y probadas
- [ ] CSV de prueba subido exitosamente
- [ ] Tweets visibles en Dashboard
- [ ] Cron job publicando tweets correctamente
- [ ] Repositorio en GitHub
- [ ] Deployed en Easypanel
- [ ] Acceso desde URL pública funcionando

## 🎉 Proyecto Completado

Tu aplicación está lista para:
- Subir CSV con tweets programados
- Publicar automáticamente cada 15 minutos
- Gestionar threads
- Adjuntar imágenes desde URLs
- Controlar límites de API (100/mes)
- Monitorear estadísticas en tiempo real

## 📚 Recursos

- Documentación completa: README.md
- API de X: https://developer.x.com/en/docs/x-api
- Supabase Docs: https://supabase.com/docs
- Easypanel Docs: https://easypanel.io/docs

## 💡 Próximos Pasos (Opcionales)

1. Configurar notificaciones por email
2. Agregar soporte para videos
3. Implementar edición de tweets pendientes
4. Calendario visual de tweets
5. Analytics integrados
6. Multi-usuario

¡Disfruta tu Tweet Scheduler! 🚀
