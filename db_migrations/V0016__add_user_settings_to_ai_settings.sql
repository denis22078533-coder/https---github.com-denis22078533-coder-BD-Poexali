-- Добавляем настройки для системы регистрации и бесплатных запросов
ALTER TABLE t_p79040548_accounting_automatio.ai_settings
  ADD COLUMN IF NOT EXISTS guest_free_limit INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS registration_bonus INT NOT NULL DEFAULT 5;

-- Если таблица _migrations существует — вставляем запись
INSERT INTO _migrations (filename) VALUES ('V0016__add_user_settings_to_ai_settings.sql')
ON CONFLICT (filename) DO NOTHING;