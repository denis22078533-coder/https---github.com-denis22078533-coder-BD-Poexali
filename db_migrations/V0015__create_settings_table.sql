-- Таблица для хранения глобальных настроек приложения (ключ-значение)
-- Используется для хранения DATABASE_URL и других параметров
CREATE TABLE IF NOT EXISTS _settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Если таблица _migrations существует — вставляем в неё запись об этой миграции
INSERT INTO _migrations (filename) VALUES ('V0015__create_settings_table.sql')
ON CONFLICT (filename) DO NOTHING;
