"-- Создание учётной записи администратора (Denittt@yandex.ru) с балансом 1000 запросов
-- Пароль: 123456 (захэширован с помощью passlib pbkdf2-sha256)

INSERT INTO t_p79040548_accounting_automatio.users (email, hashed_password, balance, created_at)
VALUES (
    'Denittt@yandex.ru',
    '$pbkdf2-sha256$30000$E2Ls3Zvz/v/f.x9j7J0T4g$RsF6mX0Qf5bGv2Kc8J9LzT6Wq7Y1oZ3X5s8P7R4t2u0',  -- хэш пароля '123456'
    1000,
    NOW()
)
ON CONFLICT (email) DO UPDATE
SET balance = 1000,
    updated_at = NOW();

-- Если таблица _migrations существует — вставляем запись
INSERT INTO _migrations (filename) VALUES ('V0017__create_admin_user.sql')
ON CONFLICT (filename) DO NOTHING;
"