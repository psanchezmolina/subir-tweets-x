-- ==============================================================================
-- SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS PARA TWEET SCHEDULER
-- ==============================================================================
-- Este script crea las 4 tablas necesarias para la aplicación:
-- 1. tweets - Tweets programados con estado
-- 2. api_counter - Contador de uso API (100 posts/mes)
-- 3. credentials - Credenciales X API encriptadas
-- 4. logs - Historial de eventos (opcional)
--
-- INSTRUCCIONES:
-- 1. Ir a tu proyecto Supabase
-- 2. Abrir SQL Editor
-- 3. Copiar y pegar este script completo
-- 4. Ejecutar (Run)
-- ==============================================================================

-- TABLA 1: tweets
-- Almacena todos los tweets programados y su estado de publicación
-- ==============================================================================
CREATE TABLE IF NOT EXISTS tweets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  texto TEXT NOT NULL CHECK (char_length(texto) <= 280),
  thread_id TEXT,
  fecha_publicacion TIMESTAMPTZ NOT NULL,
  imagen_url TEXT,
  estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'published', 'failed')),
  tweet_id TEXT,                  -- ID retornado por X API después de publicar
  error_message TEXT,             -- Mensaje de error si la publicación falla
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Índices para optimizar queries frecuentes
CREATE INDEX IF NOT EXISTS idx_tweets_estado ON tweets(estado);
CREATE INDEX IF NOT EXISTS idx_tweets_fecha ON tweets(fecha_publicacion);
CREATE INDEX IF NOT EXISTS idx_tweets_thread ON tweets(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tweets_created ON tweets(created_at DESC);

-- Comentarios para documentación
COMMENT ON TABLE tweets IS 'Almacena tweets programados con su estado y metadata';
COMMENT ON COLUMN tweets.texto IS 'Contenido del tweet (máx 280 caracteres)';
COMMENT ON COLUMN tweets.thread_id IS 'Identificador de thread (NULL = tweet individual)';
COMMENT ON COLUMN tweets.fecha_publicacion IS 'Fecha y hora programada para publicación';
COMMENT ON COLUMN tweets.estado IS 'Estado: pending | published | failed';
COMMENT ON COLUMN tweets.tweet_id IS 'ID del tweet retornado por X API';

-- ==============================================================================
-- TABLA 2: api_counter
-- Tracking del uso mensual y diario de la API de X (límite: 100 posts/mes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS api_counter (
  id SERIAL PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,    -- Formato: YYYY-MM
  calls_count INTEGER DEFAULT 0 CHECK (calls_count >= 0),
  daily_counts JSONB DEFAULT '{}', -- Tracking diario: {"2025-12-17": 5, "2025-12-18": 3}
  last_reset TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsqueda rápida por mes
CREATE INDEX IF NOT EXISTS idx_api_counter_month ON api_counter(month);

-- Comentarios
COMMENT ON TABLE api_counter IS 'Contador de llamadas API por mes (límite: 100/mes en free tier)';
COMMENT ON COLUMN api_counter.month IS 'Mes en formato YYYY-MM (ej: 2025-12)';
COMMENT ON COLUMN api_counter.calls_count IS 'Total de llamadas API este mes';
COMMENT ON COLUMN api_counter.daily_counts IS 'Desglose diario en formato JSON';

-- ==============================================================================
-- TABLA 3: credentials
-- Almacena credenciales de la API de X (encriptadas con bcrypt)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS credentials (
  id SERIAL PRIMARY KEY,
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,      -- Encriptado con bcrypt en la aplicación
  access_token TEXT NOT NULL,
  access_token_secret TEXT NOT NULL, -- Encriptado con bcrypt en la aplicación
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentarios
COMMENT ON TABLE credentials IS 'Credenciales de X API (encriptadas)';
COMMENT ON COLUMN credentials.is_active IS 'Indica si estas credenciales están activas';

-- ==============================================================================
-- TABLA 4: logs (OPCIONAL pero recomendada)
-- Historial de acciones y errores para debugging
-- ==============================================================================
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',    -- Datos adicionales en formato JSON
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas de logs
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at DESC);

-- Comentarios
COMMENT ON TABLE logs IS 'Historial de eventos de la aplicación';
COMMENT ON COLUMN logs.level IS 'Nivel de log: info | warning | error';
COMMENT ON COLUMN logs.context IS 'Datos adicionales en formato JSON';

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================
-- IMPORTANTE: Supabase activa RLS por defecto. Para desarrollo local,
-- desactivamos RLS en estas tablas. En producción, configura políticas.
-- ==============================================================================

ALTER TABLE tweets DISABLE ROW LEVEL SECURITY;
ALTER TABLE api_counter DISABLE ROW LEVEL SECURITY;
ALTER TABLE credentials DISABLE ROW LEVEL SECURITY;
ALTER TABLE logs DISABLE ROW LEVEL SECURITY;

-- Alternativa: Crear políticas permisivas para service_role
-- (descomenta si prefieres mantener RLS activado)
--
-- ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for service role" ON tweets FOR ALL USING (true) WITH CHECK (true);
--
-- ALTER TABLE api_counter ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for service role" ON api_counter FOR ALL USING (true) WITH CHECK (true);
--
-- ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for service role" ON credentials FOR ALL USING (true) WITH CHECK (true);
--
-- ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for service role" ON logs FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- DATOS INICIALES (opcional)
-- ==============================================================================

-- Insertar contador para el mes actual
INSERT INTO api_counter (month, calls_count, daily_counts)
VALUES (
  TO_CHAR(NOW(), 'YYYY-MM'),
  0,
  '{}'::jsonb
)
ON CONFLICT (month) DO NOTHING;

-- ==============================================================================
-- VERIFICACIÓN
-- ==============================================================================

-- Verificar que todas las tablas se crearon correctamente
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN ('tweets', 'api_counter', 'credentials', 'logs')
ORDER BY table_name;

-- ==============================================================================
-- FIN DEL SCRIPT
-- ==============================================================================
-- Si ves 4 tablas listadas arriba, la configuración fue exitosa!
-- Puedes cerrar este editor y continuar con la configuración de la aplicación.
-- ==============================================================================
