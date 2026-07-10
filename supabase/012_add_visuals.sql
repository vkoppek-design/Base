-- ==============================================
-- Migration 012: Add More Mermaid Diagrams to Lessons
-- ==============================================

-- Update Lesson 5 (Элемент 1: Роль)
UPDATE public.lessons
SET content = content || E'\n\n## Анатомия идеальной роли\n\n```mermaid\ngraph TD\n    Role[Идеальная роль] --> |1. Кто ИИ?| A[Профессия / Специализация]\n    Role --> |2. Какой бэкграунд?| B[Опыт работы и контекст]\n    Role --> |3. Как общаться?| C[Стиль и ограничения]\n    A & B & C --> ExpertResponse[Ответ на экспертном уровне]\n```'
WHERE id = '770e8400-e29b-41d4-a716-446655440006';

-- Update Lesson 7 (Элемент 3: Задача)
UPDATE public.lessons
SET content = content || E'\n\n## Правила постановки задачи\n\n```mermaid\ngraph LR\n    Task[Постановка задачи] --> Rule1[1. Сильный глагол: Напиши, Создай]\n    Task --> Rule2[2. Фокус: Одна задача за раз]\n    Task --> Rule3[3. Формат: Ограничения и объем]\n```'
WHERE id = '770e8400-e29b-41d4-a716-446655440202';

-- Update Lesson 8 (Элемент 4: Примеры)
UPDATE public.lessons
SET content = content || E'\n\n## Разница между подходами\n\n```mermaid\ngraph TD\n    subgraph ZeroShot [Zero-Shot: Без примеров]\n        A[Запрос без образца] --> B[ИИ рассуждает сам] --> C[Обобщенный результат]\n    end\n    subgraph FewShot [Few-Shot: С примерами]\n        D[Запрос + 2-3 примера] --> E[ИИ копирует структуру] --> F[Точный кастомный результат]\n    end\n```'
WHERE id = '770e8400-e29b-41d4-a716-446655440004';

-- Update Lesson 9 (5 золотых правил промптинга)
UPDATE public.lessons
SET content = content || E'\n\n## Цикл построения промпта по правилам\n\n```mermaid\ngraph LR\n    A[Конкретность] --> B[Контекст] --> C[Формат] --> D[Ограничения] --> E[Итерация]\n    E -->|Улучшение| A\n```'
WHERE id = '770e8400-e29b-41d4-a716-446655440002';

-- Update Lesson 10 (Типичные ошибки и как их избежать)
UPDATE public.lessons
SET content = content || E'\n\n## Ошибки и исправления\n\n```mermaid\ngraph TD\n    A[Размытый запрос] -->|Исправление| B[Конкретные рамки и роли]\n    C[Попытка решить 10 задач] -->|Исправление| D[Разбиение на шаги]\n    E[Отсутствие формата] -->|Исправление| F[Указание структуры таблицы/списка]\n```'
WHERE id = '770e8400-e29b-41d4-a716-446655440003';

-- Update Lesson 11 (Chain-of-Thought: заставляем ИИ рассуждать)
UPDATE public.lessons
SET content = content || E'\n\n## Как влияет CoT на точность вычислений\n\n```mermaid\ngraph TD\n    subgraph Обычный запрос\n        A[Сложный вопрос] -->|Сразу ответ| B[ИИ ошибается в логике]\n    end\n    subgraph Chain of Thought\n        C[Сложный вопрос] -->|Рассуждай пошагово| D[Шаг 1 -> Шаг 2 -> Шаг 3] -->|Итог| E[Высокая точность ответов]\n    end\n```'
WHERE id = '770e8400-e29b-41d4-a716-446655440005';

-- Update Lesson 12 (Продвинутые фреймворки: RISEN, RTF, COSTAR)
UPDATE public.lessons
SET content = content || E'\n\n## Архитектура фреймворков\n\n```mermaid\ngraph TD\n    subgraph Простой фреймворк: RTF\n        Role[Role] --> Task[Task] --> Format[Format]\n    end\n    subgraph Сложный фреймворк: COSTAR\n        Context[Context] --> Objective[Objective] --> Style[Style] --> Tone[Tone] --> Audience[Audience] --> Response[Response]\n      end\n```'
WHERE id = '770e8400-e29b-41d4-a716-446655440007';

-- Update Lesson 16 (Итерация и отладка промптов)
UPDATE public.lessons
SET content = content || E'\n\n## 5-шаговый цикл отладки промпта\n\n```mermaid\ngraph TD\n    A[1. Написать черновик промпта] --> B[2. Проверить результат ИИ]\n    B --> C[3. Выявить ошибки / перекосы]\n    C --> D[4. Скорректировать промпт]\n    D -->|Повторить 2-3 раза| B\n    D --> E[5. Сохранить финальный шаблон]\n```'
WHERE id = '770e8400-e29b-41d4-a716-446655440011';

-- Update Lesson 17 (Создание собственной системы промптов)
UPDATE public.lessons
SET content = content || E'\n\n## Архитектура личной промпт-системы\n\n```mermaid\ngraph LR\n    A[Библиотека в Notion/Obsidian] --> B[Шаблоны с переменными]\n    B --> C[Цепочки промптов: Шаг 1 -> Шаг 2]\n    C --> D[Экономия часов времени ежедневно]\n```'
WHERE id = '770e8400-e29b-41d4-a716-446655440012';
