-- 017_lesson_images_storage.sql
-- Хранилище для скриншотов/картинок уроков.
-- Создаёт публичный bucket lesson-images. Загрузка идёт через серверный
-- API-роут /api/admin/upload (service role), поэтому отдельные INSERT-политики
-- для пользователей не нужны. Публичный bucket => картинки доступны на чтение по URL.
-- Идемпотентно. Применять в Supabase (SQL Editor).

INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-images', 'lesson-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
