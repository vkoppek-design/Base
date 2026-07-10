-- ==============================================
-- Migration 011: Add Mermaid Diagrams to Lessons
-- ==============================================

-- Update Lesson 1 (Как думает нейросеть)
UPDATE public.lessons
SET content = content || E'\n\n## Схема работы LLM\n\n```mermaid\ngraph LR\n    User[Ваш промпт] -->|Ввод| LLM[Нейросеть (LLM)]\n    LLM -->|Вычисление вероятностей| Word[Подбор следующего слова]\n    Word -->|Вывод| Output[Связный ответ]\n```'
WHERE id = '770e8400-e29b-41d4-a716-446655440101';

-- Update Lesson 2 (Формат чата vs ИИ-Агент)
UPDATE public.lessons
SET content = content || E'\n\n## Разница в архитектуре\n\n```mermaid\ngraph TD\n    subgraph ЧАТ [Базовый чат]\n        A[Юзер] -->|Свободный вопрос| B[LLM]\n        B -->|Обобщенный ответ| A\n    end\n    subgraph АГЕНТ [ИИ-Агент]\n        C[Юзер] -->|Цель / Задача| D[Агент: Роль + Правила]\n        D -->|Системная инструкция| E[LLM]\n        E -->|Ответ| D\n        D -->|Экспертный результат| C\n    end\n```'
WHERE id = '770e8400-e29b-41d4-a716-446655440102';

-- Update Lesson 3 (Мультиагентные системы)
UPDATE public.lessons
SET content = content || E'\n\n## Схема мультиагентного взаимодействия (на примере написания статьи)\n\n```mermaid\ngraph LR\n    User[Юзер] -->|Задача| A[Агент-Маркетолог]\n    A -->|1. ТЗ| B[Агент-Копирайтер]\n    B -->|2. Черновик| C[Агент-Редактор]\n    C -->|3. Анализ ошибок| B\n    C -->|4. Готовый текст| D[Агент-Оптимизатор]\n    D -->|5. Публикация| User\n```'
WHERE id = '770e8400-e29b-41d4-a716-446655440103';

-- Update Lesson 4 (Что такое промпт)
UPDATE public.lessons
SET content = content || E'\n\n## Анатомия промпта\n\n```mermaid\ngraph TD\n    Prompt[ПРОМПТ] --> Role[1. Роль: Кто ИИ?]\n    Prompt --> Context[2. Контекст: Какие вводные?]\n    Prompt --> Task[3. Задача: Что делать?]\n    Prompt --> Examples[4. Примеры: Как оформить?]\n```'
WHERE id = '770e8400-e29b-41d4-a716-446655440001';

-- Update Lesson 6 (Элемент 2: Контекст)
UPDATE public.lessons
SET content = content || E'\n\n## Метод обратного планирования\n\n```mermaid\ngraph TD\n    A[1. Желаемый результат X] -->|Анализ| B[2. Какая информация нужна?]\n    B -->|Сбор данных| C[3. Описание продукта, ЦА, лимитов]\n    C -->|Формирование| D[4. Готовый блок контекста]\n```'
WHERE id = '770e8400-e29b-41d4-a716-446655440201';
