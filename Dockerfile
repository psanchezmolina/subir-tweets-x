# Dockerfile para Tweet Scheduler
# Imagen base optimizada de Node.js

FROM node:18-alpine

# Metadata
LABEL maintainer="Tu nombre <tu@email.com>"
LABEL description="Tweet Scheduler - Programador automático de tweets para X/Twitter"

# Directorio de trabajo
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias de producción solamente
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copiar código fuente
COPY . .

# Crear directorio para uploads
RUN mkdir -p uploads && \
    chmod 755 uploads

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto (sobreescribir en deployment)
ENV NODE_ENV=production
ENV PORT=3000

# Usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/auth/status', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando de inicio
CMD ["node", "server.js"]
