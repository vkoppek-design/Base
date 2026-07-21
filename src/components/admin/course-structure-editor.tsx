"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/shared/toast-provider";
import type { CourseTopic, CourseTopicLesson, Lesson, Topic } from "@/types";
import { ArrowUp, ArrowDown, X, Plus, Loader2 } from "lucide-react";

interface IncludedLesson {
  ctlId: string;
  lesson: Lesson;
  sort_order: number;
}

interface StructureTopic {
  courseTopic: CourseTopic;
  topic: Topic;
  included: IncludedLesson[]; // ordered
  topicLessons: Lesson[]; // all lessons belonging to this topic
}

// Course-level structure: order the course's topics, and within each pick a
// subset of that topic's lessons and order them for this course.
export default function CourseStructureEditor({ courseId }: { courseId: string }) {
  const [structure, setStructure] = useState<StructureTopic[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [lessonsByTopic, setLessonsByTopic] = useState<Map<string, Lesson[]>>(new Map());
  const [pickedTopicId, setPickedTopicId] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { addToast } = useToast();

  const load = async () => {
    const [ctRes, topicsRes, lessonsRes] = await Promise.all([
      supabase.from("course_topics").select("*").eq("course_id", courseId).order("sort_order"),
      supabase.from("topics").select("*").order("title"),
      supabase.from("lessons").select("*").not("topic_id", "is", null),
    ]);
    const courseTopics: CourseTopic[] = ctRes.data || [];
    const topics: Topic[] = topicsRes.data || [];
    const lessons: Lesson[] = lessonsRes.data || [];

    const byTopic = new Map<string, Lesson[]>();
    for (const l of lessons) {
      if (!l.topic_id) continue;
      const arr = byTopic.get(l.topic_id) || [];
      arr.push(l);
      byTopic.set(l.topic_id, arr);
    }

    const ctIds = courseTopics.map((ct) => ct.id);
    const ctlRes = ctIds.length
      ? await supabase.from("course_topic_lessons").select("*").in("course_topic_id", ctIds)
      : { data: [] as CourseTopicLesson[] };
    const ctls: CourseTopicLesson[] = ctlRes.data || [];
    const lessonById = new Map(lessons.map((l) => [l.id, l]));

    const built: StructureTopic[] = courseTopics.map((ct) => {
      const topic = topics.find((t) => t.id === ct.topic_id)!;
      const included: IncludedLesson[] = ctls
        .filter((c) => c.course_topic_id === ct.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({ ctlId: c.id, lesson: lessonById.get(c.lesson_id)!, sort_order: c.sort_order }))
        .filter((x) => x.lesson);
      return { courseTopic: ct, topic, included, topicLessons: byTopic.get(ct.topic_id) || [] };
    }).filter((s) => s.topic);

    setStructure(built);
    setAllTopics(topics);
    setLessonsByTopic(byTopic);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const addedTopicIds = new Set(structure.map((s) => s.topic.id));
  const availableTopics = allTopics.filter((t) => !addedTopicIds.has(t.id));

  const addTopic = async () => {
    if (!pickedTopicId) return;
    const nextSort = structure.length ? Math.max(...structure.map((s) => s.courseTopic.sort_order)) + 1 : 0;
    const { error } = await supabase.from("course_topics").insert({ course_id: courseId, topic_id: pickedTopicId, sort_order: nextSort });
    if (error) return addToast("Не удалось добавить тему", "error");
    setPickedTopicId("");
    load();
  };

  const removeTopic = async (ctId: string) => {
    if (!confirm("Убрать тему из курса? Уроки и сами темы не удаляются.")) return;
    await supabase.from("course_topics").delete().eq("id", ctId);
    load();
  };

  const moveTopic = async (index: number, dir: -1 | 1) => {
    const other = structure[index + dir];
    if (!other) return;
    const cur = structure[index];
    await Promise.all([
      supabase.from("course_topics").update({ sort_order: other.courseTopic.sort_order }).eq("id", cur.courseTopic.id),
      supabase.from("course_topics").update({ sort_order: cur.courseTopic.sort_order }).eq("id", other.courseTopic.id),
    ]);
    load();
  };

  const addLesson = async (ct: StructureTopic, lessonId: string) => {
    const nextSort = ct.included.length ? Math.max(...ct.included.map((i) => i.sort_order)) + 1 : 0;
    const { error } = await supabase.from("course_topic_lessons").insert({ course_topic_id: ct.courseTopic.id, lesson_id: lessonId, sort_order: nextSort });
    if (error) return addToast("Не удалось добавить урок", "error");
    load();
  };

  const removeLesson = async (ctlId: string) => {
    await supabase.from("course_topic_lessons").delete().eq("id", ctlId);
    load();
  };

  const moveLesson = async (ct: StructureTopic, index: number, dir: -1 | 1) => {
    const other = ct.included[index + dir];
    if (!other) return;
    const cur = ct.included[index];
    await Promise.all([
      supabase.from("course_topic_lessons").update({ sort_order: other.sort_order }).eq("id", cur.ctlId),
      supabase.from("course_topic_lessons").update({ sort_order: cur.sort_order }).eq("id", other.ctlId),
    ]);
    load();
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted" />;

  return (
    <div className="space-y-4">
      {structure.length === 0 && <p className="text-sm text-muted">В курсе пока нет тем. Добавьте первую тему ниже.</p>}

      {structure.map((s, ti) => {
        const includedIds = new Set(s.included.map((i) => i.lesson.id));
        const notIncluded = s.topicLessons.filter((l) => !includedIds.has(l.id));
        return (
          <div key={s.courseTopic.id} className="rounded-xl border border-border bg-input p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted shrink-0">{ti + 1}.</span>
              <span className="flex-1 font-medium text-foreground truncate">{s.topic.title}</span>
              <button type="button" onClick={() => moveTopic(ti, -1)} disabled={ti === 0} className="p-1.5 rounded-lg text-muted hover:text-foreground disabled:opacity-30 cursor-pointer">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => moveTopic(ti, 1)} disabled={ti === structure.length - 1} className="p-1.5 rounded-lg text-muted hover:text-foreground disabled:opacity-30 cursor-pointer">
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => removeTopic(s.courseTopic.id)} className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/10 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 pl-5">
              {s.included.length === 0 ? (
                <p className="text-xs text-muted">Уроки для курса не выбраны</p>
              ) : (
                s.included.map((il, li) => (
                  <div key={il.ctlId} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border">
                    <span className="flex-1 text-sm text-foreground truncate">{il.lesson.title}</span>
                    <button type="button" onClick={() => moveLesson(s, li, -1)} disabled={li === 0} className="p-1 text-muted hover:text-foreground disabled:opacity-30 cursor-pointer">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => moveLesson(s, li, 1)} disabled={li === s.included.length - 1} className="p-1 text-muted hover:text-foreground disabled:opacity-30 cursor-pointer">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => removeLesson(il.ctlId)} className="p-1 text-muted hover:text-error cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}

              {notIncluded.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {notIncluded.map((l) => (
                    <button key={l.id} type="button" onClick={() => addLesson(s, l.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border text-xs text-muted hover:text-foreground hover:border-accent transition-colors cursor-pointer">
                      <Plus className="w-3 h-3" />
                      {l.title}
                    </button>
                  ))}
                </div>
              )}
              {s.topicLessons.length === 0 && (
                <p className="text-xs text-muted">В этой теме нет уроков — добавьте их в редакторе темы.</p>
              )}
            </div>
          </div>
        );
      })}

      {availableTopics.length > 0 && (
        <div className="flex gap-2">
          <select value={pickedTopicId} onChange={(e) => setPickedTopicId(e.target.value)} className="flex-1 px-4 py-2.5 rounded-xl bg-input border border-border focus:border-accent outline-none text-sm text-foreground">
            <option value="">Добавить тему в курс…</option>
            {availableTopics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <button type="button" onClick={addTopic} disabled={!pickedTopicId} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-input border border-border text-sm text-foreground hover:border-accent transition-colors disabled:opacity-50 cursor-pointer">
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
      )}
    </div>
  );
}
