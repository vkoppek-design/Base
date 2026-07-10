-- =========================================================================
-- Migration 014: Copy Business Prompts (Block 2 & 3) from Business Course
-- to the Main Course ("Нейросети"), under topic "ИИ-Агенты".
-- =========================================================================

-- 1. Update existing lessons in the "ИИ-Агенты" topic of the Main Course
-- to place them in a clean introductory block and set correct sort order.
UPDATE public.lessons 
SET block_name = 'Блок 1. Основы ИИ-агентов', sort_order = 1 
WHERE id = '660e8400-e29b-41d4-a716-446655440004';

UPDATE public.lessons 
SET block_name = 'Блок 1. Основы ИИ-агентов', sort_order = 2 
WHERE id = '660e8400-e29b-41d4-a716-446655440005';

-- 2. Clear previously copied lessons to ensure idempotency (prevent duplicates)
DELETE FROM public.lessons 
WHERE id IN (
  SELECT cast(md5(id::text) as uuid)
  FROM public.lessons
  WHERE topic_id IN (
    '660e8400-e29b-41d4-a716-446655440002',
    '660e8400-e29b-41d4-a716-446655440003',
    '660e8400-e29b-41d4-a716-446655440004',
    '660e8400-e29b-41d4-a716-446655440005',
    '660e8400-e29b-41d4-a716-446655440006',
    '660e8400-e29b-41d4-a716-446655440007'
  )
);

-- 3. Copy lessons with new deterministic UUIDs, target topic ID, offsets and block names
INSERT INTO public.lessons (id, topic_id, title, content, video_url, sort_order, duration_minutes, block_name, is_published)
SELECT 
  cast(md5(id::text) as uuid) AS id,
  '550e8400-e29b-41d4-a716-446655440002'::uuid AS topic_id,
  title,
  content,
  video_url,
  CASE 
    WHEN topic_id = '660e8400-e29b-41d4-a716-446655440002' THEN 10 + sort_order
    WHEN topic_id = '660e8400-e29b-41d4-a716-446655440003' THEN 20 + sort_order
    WHEN topic_id = '660e8400-e29b-41d4-a716-446655440004' THEN 30 + sort_order
    WHEN topic_id = '660e8400-e29b-41d4-a716-446655440005' THEN 40 + sort_order
    WHEN topic_id = '660e8400-e29b-41d4-a716-446655440006' THEN 50 + sort_order
    WHEN topic_id = '660e8400-e29b-41d4-a716-446655440007' THEN 60 + sort_order
  END AS sort_order,
  duration_minutes,
  CASE 
    WHEN topic_id = '660e8400-e29b-41d4-a716-446655440002' THEN 'Блок 2. Стратегия и планирование'
    WHEN topic_id = '660e8400-e29b-41d4-a716-446655440003' THEN 'Блок 3. Финансы и операционка'
    WHEN topic_id = '660e8400-e29b-41d4-a716-446655440004' THEN 'Блок 4. Управление командой и HR'
    WHEN topic_id = '660e8400-e29b-41d4-a716-446655440005' THEN 'Блок 5. Маркетинг и продажи'
    WHEN topic_id = '660e8400-e29b-41d4-a716-446655440006' THEN 'Блок 6. Коммуникация и переговоры'
    WHEN topic_id = '660e8400-e29b-41d4-a716-446655440007' THEN 'Блок 7. Документы и регламенты'
  END AS block_name,
  is_published
FROM public.lessons
WHERE topic_id IN (
  '660e8400-e29b-41d4-a716-446655440002',
  '660e8400-e29b-41d4-a716-446655440003',
  '660e8400-e29b-41d4-a716-446655440004',
  '660e8400-e29b-41d4-a716-446655440005',
  '660e8400-e29b-41d4-a716-446655440006',
  '660e8400-e29b-41d4-a716-446655440007'
);
