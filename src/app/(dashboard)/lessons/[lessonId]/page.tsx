"use client";

import { useEffect, useState, use, useMemo, useRef, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { useProgress } from "@/hooks/use-progress";
import { useToast } from "@/components/shared/toast-provider";
import { CodeBlockWrapper } from "@/components/lesson/code-block";
import { SpecialtyFilter } from "@/components/lesson/specialty-filter";
import { LessonFileBlock } from "@/components/lesson/lesson-materials";
import { QuizSection } from "@/components/lesson/quiz-section";
import { filterContentBySpecialty, type Specialty } from "@/lib/specialties";
import { formatDuration, getYouTubeEmbedUrl } from "@/lib/utils";
import { parseMarkerLine } from "@/lib/lesson-content";
import { buildCourseTree } from "@/lib/course-structure";
import type { Lesson, Topic, Progress } from "@/types";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  X,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Loader2,
  Play,
  ImagePlus,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

interface LessonWithTopic extends Lesson {
  topic: Topic;
}

interface TopicWithLessons extends Topic {
  lessons: (Lesson & { completed: boolean })[];
}

// Topic ID for Prompt Engineering module
const PROMPT_ENGINEERING_TOPIC_ID = "550e8400-e29b-41d4-a716-446655440001";

// Build a URL-safe anchor id from heading text (keeps Cyrillic letters)
const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

// Escape a string for safe use inside a RegExp
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Split markdown into top-level segments by blank lines, keeping fenced code blocks whole
const splitSegments = (md: string): string[] => {
  const segments: string[] = [];
  let buffer: string[] = [];
  let inCode = false;
  const flush = () => {
    if (buffer.join("\n").trim()) segments.push(buffer.join("\n").trim());
    buffer = [];
  };
  for (const line of md.split("\n")) {
    const isFence = line.trim().startsWith("```");
    if (isFence) inCode = !inCode;
    if (!inCode && !isFence && line.trim() === "") {
      flush();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return segments;
};

// Admin-only affordance to insert an image between content segments (small "+")
function InsertImageRow({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <div className="my-1 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title="Добавить изображение"
        className="w-7 h-7 flex items-center justify-center rounded-full border border-dashed border-border text-muted hover:text-accent hover:border-accent/60 transition-all cursor-pointer disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

// Extract plain text from React markdown children (for heading ids)
const nodeToText = (node: React.ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return nodeToText((node as { props?: { children?: React.ReactNode } }).props?.children);
  }
  return "";
};

export default function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const searchParams = useSearchParams();
  const courseCtxId = searchParams.get("course");
  const courseHref = courseCtxId ? `?course=${courseCtxId}` : "";
  const [lesson, setLesson] = useState<LessonWithTopic | null>(null);
  const [topics, setTopics] = useState<TopicWithLessons[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sequentialAccess, setSequentialAccess] = useState(false);
  const [activeBlock, setActiveBlock] = useState(0);
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty>("all");
  const [uploadTarget, setUploadTarget] = useState<
    | { kind: "placeholder"; placeholder: string }
    | { kind: "insert"; segIndex: number; blockContent: string }
    | null
  >(null);
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const blockInitedRef = useRef(false);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const { user, profile, loading: userLoading } = useUser();
  const { markComplete, markIncomplete, loading: progressLoading } = useProgress(user?.id || "");
  const { addToast } = useToast();
  const router = useRouter();
  const supabase = createClient();

  // Check if current lesson belongs to prompt engineering topic
  const isPromptEngineeringLesson = lesson?.topic_id === PROMPT_ENGINEERING_TOPIC_ID;

  // Check if content has specialty markers
  const hasSpecialtyContent = useMemo(() => {
    if (!lesson?.content) return false;
    return lesson.content.includes("<!-- SPEC:");
  }, [lesson?.content]);

  // Filter content by selected specialty and strip duplicate H1 title
  const filteredContent = useMemo(() => {
    if (!lesson?.content) return "";
    const rawContent = hasSpecialtyContent
      ? filterContentBySpecialty(lesson.content, selectedSpecialty)
      : lesson.content;

    // Remove the first H1 header (# Title) at the start of markdown to prevent duplication with the page header
    const trimmed = rawContent.trimStart();
    return trimmed.replace(/^#\s+[^\r\n]+(\r?\n)*/, "");
  }, [lesson?.content, selectedSpecialty, hasSpecialtyContent]);

  // Split lesson markdown into blocks by H2 headings (skipping code fences).
  // Each block becomes its own sub-page for sequential courses.
  const blocks = useMemo(() => {
    if (!filteredContent) return [] as { id: string; title: string; content: string }[];
    const result: { id: string; title: string; content: string }[] = [];
    let inCode = false;
    const preamble: string[] = [];
    let current: { id: string; title: string; lines: string[] } | null = null;
    for (const line of filteredContent.split("\n")) {
      const isFence = line.trim().startsWith("```");
      if (isFence) inCode = !inCode;
      const m = !inCode && !isFence ? /^##\s+(.+?)\s*$/.exec(line) : null;
      if (m) {
        if (current) result.push({ id: current.id, title: current.title, content: current.lines.join("\n") });
        const title = m[1].replace(/[*_`]/g, "").trim();
        current = { id: slugify(title), title, lines: [line] };
      } else if (current) {
        current.lines.push(line);
      } else {
        preamble.push(line);
      }
    }
    if (current) result.push({ id: current.id, title: current.title, content: current.lines.join("\n") });
    if (result.length > 0 && preamble.join("\n").trim()) {
      result[0] = { ...result[0], content: `${preamble.join("\n")}\n${result[0].content}` };
    }
    return result;
  }, [filteredContent]);

  const toc = useMemo(() => blocks.map((b) => ({ id: b.id, text: b.title })), [blocks]);

  // Paginate (one block per sub-page) for sequential courses with multiple blocks
  const paginated = sequentialAccess && blocks.length > 1;
  const safeBlock = Math.min(activeBlock, Math.max(0, blocks.length - 1));
  const displayContent = paginated ? blocks[safeBlock]?.content ?? "" : filteredContent;
  const segments = useMemo(() => splitSegments(displayContent), [displayContent]);

  // Reset to first block when switching lessons
  useEffect(() => {
    setActiveBlock(0);
    blockInitedRef.current = false;
  }, [lessonId]);

  // On first load, honor ?b=<index> deep link
  useEffect(() => {
    if (blockInitedRef.current || blocks.length === 0) return;
    blockInitedRef.current = true;
    const b = parseInt(new URLSearchParams(window.location.search).get("b") || "0", 10);
    if (!isNaN(b) && b > 0 && b < blocks.length) setActiveBlock(b);
  }, [blocks.length]);

  // Reflect active block in the URL and scroll to top on block change
  useEffect(() => {
    if (!paginated) return;
    const base = window.location.pathname;
    window.history.replaceState(null, "", safeBlock > 0 ? `${base}?b=${safeBlock}` : base);
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [safeBlock, paginated]);

  const handleTocClick = (index: number, id: string) => {
    if (paginated) {
      setActiveBlock(index);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setSidebarOpen(false);
  };

  const isAdmin = profile?.role === "admin";
  const editing = isAdmin && editMode; // editing affordances are hidden until admin enables edit mode

  // Persist edited lesson content (admin-only inline editing of screenshots)
  const persistContent = async (newContent: string) => {
    if (!lesson) return;
    setLesson({ ...lesson, content: newContent });
    const { error } = await supabase.from("lessons").update({ content: newContent }).eq("id", lesson.id);
    if (error) addToast("Не удалось сохранить изменения урока", "error");
  };

  const handleScreenshotPick = (placeholder: string) => {
    setUploadTarget({ kind: "placeholder", placeholder });
    screenshotInputRef.current?.click();
  };

  const handleInsertPick = (segIndex: number) => {
    const blockContent = paginated ? blocks[safeBlock]?.content ?? "" : filteredContent;
    setUploadTarget({ kind: "insert", segIndex, blockContent });
    screenshotInputRef.current?.click();
  };

  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const target = uploadTarget;
    if (!file || !target || !lesson?.content) return;

    setScreenshotUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка загрузки");

      // Preload so the image is in the browser cache before it renders
      // (иначе свежий URL из Storage иногда не успевает отдаться и требуется перезагрузка)
      await new Promise<void>((resolve) => {
        const pre = new Image();
        pre.onload = () => resolve();
        pre.onerror = () => resolve();
        pre.src = json.url;
      });

      const image = `![Скриншот|100](${json.url})`;
      if (target.kind === "placeholder") {
        // Replace the [СКРИН: ...] placeholder (optionally wrapped in backticks).
        // Wrap in blank lines so the image becomes its own block — important when
        // several placeholders share one paragraph (e.g. ChatGPT + Gemini).
        const re = new RegExp("`?" + escapeRegex(target.placeholder) + "`?");
        await persistContent(lesson.content.replace(re, () => `\n\n${image}\n\n`));
      } else {
        // Insert the image after the chosen segment of the current block
        const segs = splitSegments(target.blockContent);
        segs.splice(target.segIndex + 1, 0, image);
        await persistContent(lesson.content.replace(target.blockContent, () => segs.join("\n\n")));
      }
      addToast("Изображение добавлено", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Ошибка загрузки", "error");
    } finally {
      setScreenshotUploading(false);
      setUploadTarget(null);
    }
  };

  const setImageWidth = async (url: string, width: number) => {
    if (!lesson?.content) return;
    const re = new RegExp("!\\[[^\\]]*\\]\\(" + escapeRegex(url) + "\\)");
    await persistContent(lesson.content.replace(re, () => `![Скриншот|${width}](${url})`));
  };

  const deleteImage = async (url: string) => {
    if (!lesson?.content) return;
    if (!window.confirm("Удалить это изображение? Действие необратимо.")) return;
    // Remove the image markdown along with surrounding blank lines
    const re = new RegExp("\\n*!\\[[^\\]]*\\]\\(" + escapeRegex(url) + "\\)\\n*");
    await persistContent(lesson.content.replace(re, "\n\n"));
    addToast("Изображение удалено", "info");
  };

  const mdComponents: Components = {
    pre: CodeBlockWrapper,
    h2: ({ children }) => (
      <h2 id={slugify(nodeToText(children))} className="scroll-mt-6">
        {children}
      </h2>
    ),
    p: ({ children }) => {
      const text = nodeToText(children).trim();
      const placeholders = text.match(/\[СКРИН:[^\]]*\]/g);
      const residue = text.replace(/\[СКРИН:[^\]]*\]/g, "").trim();
      // A paragraph made up solely of [СКРИН: ...] placeholder(s)
      if (placeholders && residue === "") {
        if (!editing) return null; // hidden unless admin is in edit mode
        return (
          <span className="my-5 flex flex-col gap-2">
            {placeholders.map((ph, i) => {
              const uploading = screenshotUploading && uploadTarget?.kind === "placeholder" && uploadTarget.placeholder === ph;
              const desc = ph.replace(/^\[СКРИН:\s*/, "").replace(/\]$/, "");
              return (
                <span
                  key={`${ph}-${i}`}
                  onClick={() => !uploading && handleScreenshotPick(ph)}
                  className="flex flex-col items-center justify-center gap-1.5 p-6 rounded-2xl border-2 border-dashed border-border hover:border-accent/60 bg-card/40 hover:bg-card/60 text-center cursor-pointer transition-all"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  ) : (
                    <ImagePlus className="w-5 h-5 text-accent" />
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {uploading ? "Загрузка…" : "Добавить скриншот"}
                  </span>
                  {desc && <span className="text-xs text-muted">{desc}</span>}
                </span>
              );
            })}
          </span>
        );
      }
      return <p>{children}</p>;
    },
    img: ({ src, alt }) => {
      const altStr = typeof alt === "string" ? alt : "";
      const m = altStr.match(/\|(\d+)\s*$/);
      const width = m ? Math.min(100, Math.max(10, parseInt(m[1], 10))) : 100;
      const label = altStr.replace(/\|\d+\s*$/, "").trim() || "Скриншот";
      return (
        <span className="block my-4 text-center">
          <img
            src={src}
            alt={label}
            style={{
              width: `${width}%`,
              maxWidth: "100%",
              display: "block",
              marginLeft: "auto",
              marginRight: "auto",
            }}
            onClick={() => {
              if (typeof src === "string") setActiveImage(src);
            }}
            className="rounded-xl cursor-zoom-in"
          />
          {editing && typeof src === "string" && (
            <span className="mt-2 flex items-center justify-center flex-wrap gap-1.5 text-xs text-muted">
              <span>Размер:</span>
              {[25, 50, 75, 100].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setImageWidth(src, w)}
                  className={`px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                    width === w
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border hover:text-foreground"
                  }`}
                >
                  {w}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => deleteImage(src)}
                className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded-md border border-border text-error hover:bg-error/10 hover:border-error/40 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Удалить
              </button>
            </span>
          )}
        </span>
      );
    },
  };

  // A content segment is either plain markdown, or a lone <!-- FILE/QUIZ/VIDEO
  // --> marker on its own line — render the matching inline embed for those.
  const renderSegment = (seg: string) => {
    const marker = parseMarkerLine(seg);
    if (!marker) {
      return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {seg}
        </ReactMarkdown>
      );
    }
    if (marker.type === "file") return <LessonFileBlock attachmentId={marker.attachmentId} />;
    if (marker.type === "quiz") return <QuizSection lessonId={lessonId} quizId={marker.quizId} />;
    const embedUrl = getYouTubeEmbedUrl(marker.url) || marker.url;
    return (
      <div className="mb-8 rounded-2xl overflow-hidden border border-border bg-card">
        <div className="aspect-video">
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={lesson?.title || "Видео урока"}
          />
        </div>
      </div>
    );
  };

  useEffect(() => {
    // Don't fetch until useUser has finished loading
    if (userLoading) return;

    // If no user after loading is done, redirect to login
    if (!user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    const loadFromCache = () => {
      if (typeof window === "undefined") return false;
      
      const cachedCoursesStr = localStorage.getItem("lms-courses-cache");
      const completedIdsStr = localStorage.getItem("lms-progress-completed-ids") || "[]";
      
      if (!cachedCoursesStr) return false;
      
      try {
        const cachedCourses = JSON.parse(cachedCoursesStr);
        if (!Array.isArray(cachedCourses)) return false;
        
        let completedIds: string[] = [];
        try {
          completedIds = JSON.parse(completedIdsStr);
          if (!Array.isArray(completedIds)) completedIds = [];
        } catch (e) {
          console.error("Error parsing lms-progress-completed-ids cache:", e);
        }
        const completedSet = new Set(completedIds);
        
        // Pick the course context: the ?course= course if given, else the
        // first cached course that contains this lesson.
        const candidateCourses = courseCtxId
          ? cachedCourses.filter((c: any) => c.id === courseCtxId)
          : cachedCourses;

        let foundLesson: LessonWithTopic | null = null;
        let targetCourse: any = null;

        for (const course of candidateCourses) {
          if (!course.topics || !Array.isArray(course.topics)) continue;
          for (const topic of course.topics) {
            const matchingLesson = (topic.lessons || []).find((l: any) => l.id === lessonId);
            if (matchingLesson) {
              foundLesson = { ...matchingLesson, topic: { ...topic } };
              targetCourse = course;
              break;
            }
          }
          if (foundLesson) break;
        }

        if (!foundLesson || !targetCourse) {
          return false;
        }

        // Topics are already course-ordered in the cache (built by useCourses).
        const allTopics: TopicWithLessons[] = (targetCourse.topics || []).map((topic: any) => ({
          ...topic,
          lessons: (topic.lessons || []).map((l: any) => ({ ...l, completed: completedSet.has(l.id) })),
        }));

        setLesson(foundLesson);
        setTopics(allTopics);
        setSequentialAccess(!!targetCourse.sequential_access);
        setIsCompleted(completedSet.has(lessonId));
        
        // Expand current topic
        const currentTopic = allTopics.find(t => 
          t.lessons.some(l => l.id === lessonId)
        );
        if (currentTopic) {
          setExpandedTopics(new Set([currentTopic.id]));
        }
        
        console.log("[PWA] Successfully loaded lesson page data from local cache");
        return true;
      } catch (e) {
        console.error("Error loading lesson page data from cache:", e);
        return false;
      }
    };

    const fetchData = async () => {
      setLoading(true);
      
      // If offline, try cache first
      if (typeof window !== "undefined" && !navigator.onLine) {
        const success = loadFromCache();
        if (success) {
          setLoading(false);
          return;
        }
      }
      
      try {
        // Fetch the current lesson (content included).
        const { data: lessonData, error: lessonError } = await supabase
          .from("lessons")
          .select("*")
          .eq("id", lessonId)
          .single();

        if (lessonError || !lessonData) {
          console.warn("Supabase failed to fetch lesson, checking cache...", lessonError);
          const success = loadFromCache();
          if (success) return;
          router.push("/dashboard");
          return;
        }

        // Determine which course provides the ordering/gating context: the
        // ?course= course if present, else any course containing this lesson.
        let ctxCourseId: string | null = courseCtxId;
        if (!ctxCourseId) {
          const { data: ctlForLesson } = await supabase
            .from("course_topic_lessons")
            .select("course_topic_id")
            .eq("lesson_id", lessonId);
          const ctIdsForLesson = (ctlForLesson || []).map((r: any) => r.course_topic_id);
          if (ctIdsForLesson.length) {
            const { data: cts } = await supabase
              .from("course_topics")
              .select("course_id")
              .in("id", ctIdsForLesson)
              .limit(1);
            ctxCourseId = cts?.[0]?.course_id ?? null;
          }
        }

        // Fetch that course's structure rows (RLS scopes to what's visible).
        let courseRow: any = null;
        let ctRows: any[] = [];
        let ctlRows: any[] = [];
        let topicsAll: any[] = [];
        let lessonsAll: any[] = [];
        if (ctxCourseId) {
          const [courseRes, ctRes, topicsRes, lessonsRes] = await Promise.all([
            supabase.from("courses").select("*").eq("id", ctxCourseId).single(),
            supabase.from("course_topics").select("*").eq("course_id", ctxCourseId).order("sort_order"),
            supabase.from("topics").select("*"),
            supabase.from("lessons").select("*"),
          ]);
          courseRow = courseRes.data;
          ctRows = ctRes.data || [];
          topicsAll = topicsRes.data || [];
          lessonsAll = lessonsRes.data || [];
          const ctIds2 = ctRows.map((c: any) => c.id);
          if (ctIds2.length) {
            const { data } = await supabase.from("course_topic_lessons").select("*").in("course_topic_id", ctIds2);
            ctlRows = data || [];
          }
        }

        // Fetch progress
        let progressData: Progress[] = [];
        if (user?.id) {
          const { data, error: progressError } = await supabase
            .from("progress")
            .select("*")
            .eq("user_id", user.id);
            
          if (progressError) {
            console.warn("Supabase failed to fetch progress, using cache for progress...", progressError);
            const completedIdsStr = localStorage.getItem("lms-progress-completed-ids") || "[]";
            try {
              const cachedCompleted = JSON.parse(completedIdsStr);
              if (Array.isArray(cachedCompleted)) {
                progressData = cachedCompleted.map(id => ({
                  user_id: user.id,
                  lesson_id: id,
                  completed: true,
                  completed_at: new Date().toISOString(),
                } as Progress));
              }
            } catch (e) {
              console.error(e);
            }
          } else {
            progressData = data || [];
            // Cache the progress completed ids
            if (typeof window !== "undefined") {
              const completedIds = progressData.filter(p => p.completed).map(p => p.lesson_id);
              localStorage.setItem("lms-progress-completed-ids", JSON.stringify(completedIds));
            }
          }
        }

        const completedIds = new Set(progressData.filter(p => p.completed).map(p => p.lesson_id));
        setIsCompleted(completedIds.has(lessonId));

        // Build the ordered course tree and derive the sidebar + gating context.
        let topicsWithLessons: TopicWithLessons[] = [];
        let homeTopic: Topic | undefined;
        if (courseRow) {
          const [tree] = buildCourseTree({
            courses: [courseRow],
            courseTopics: ctRows,
            courseTopicLessons: ctlRows,
            topics: topicsAll,
            lessons: lessonsAll,
            completedIds,
          });
          setSequentialAccess(!!tree?.sequential_access);
          topicsWithLessons = (tree?.topics || []).map((t) => ({
            ...t,
            lessons: t.lessons.map((l) => ({ ...l, completed: completedIds.has(l.id) })),
          }));
          homeTopic = tree?.topics.find((t) => t.lessons.some((l) => l.id === lessonId));
        }

        // Fall back to the lesson's own topic for the header/breadcrumb if it
        // isn't part of the resolved course.
        if (!homeTopic && lessonData.topic_id) {
          const { data: ownTopic } = await supabase.from("topics").select("*").eq("id", lessonData.topic_id).single();
          if (ownTopic) homeTopic = ownTopic as Topic;
        }

        setLesson({ ...lessonData, topic: homeTopic || ({ id: "", title: "" } as Topic) } as LessonWithTopic);
        setTopics(topicsWithLessons);

        const currentTopic = topicsWithLessons.find((t) => t.lessons.some((l) => l.id === lessonId));
        if (currentTopic) {
          setExpandedTopics(new Set([currentTopic.id]));
        }
      } catch (error) {
        console.error("Error fetching lesson data:", error);
        loadFromCache();
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [lessonId, user?.id, userLoading, profile?.role]);

  // Client-side sequential gate: if this lesson is locked in the course order
  // (the previous lesson isn't completed), send the student back to the course.
  useEffect(() => {
    if (loading || !lesson || profile?.role === "admin" || !sequentialAccess) return;
    const flat = topics.flatMap((t) => t.lessons);
    const idx = flat.findIndex((l) => l.id === lessonId);
    if (idx > 0 && !flat[idx - 1].completed) {
      addToast("Урок откроется после прохождения предыдущего.", "info");
      router.push(courseCtxId ? `/courses/${courseCtxId}` : "/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, lesson, topics, sequentialAccess, lessonId]);

  const handleToggleComplete = async () => {
    if (isCompleted) {
      const { error } = await markIncomplete(lessonId);
      if (!error) {
        setIsCompleted(false);
        addToast("Отметка снята", "info");
      } else {
        addToast("Ошибка при обновлении прогресса", "error");
      }
    } else {
      const { error } = await markComplete(lessonId);
      if (!error) {
        setIsCompleted(true);
        addToast("Урок отмечен как пройденный! 🎉", "success");
      } else {
        addToast("Ошибка при обновлении прогресса", "error");
      }
    }
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  };

  // Find prev/next lessons
  const allLessons = topics.flatMap(t => t.lessons);
  const currentIndex = allLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  if (loading) {
    return (
      <div className="flex h-screen">
        <div className="hidden lg:block w-80 border-r border-border p-4 space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-10 skeleton rounded-lg" />)}
        </div>
        <div className="flex-1 p-8">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="h-8 w-64 skeleton rounded" />
            <div className="h-4 w-48 skeleton rounded" />
            <div className="h-64 skeleton rounded-xl mt-6" />
            <div className="space-y-2 mt-6">
              {[1,2,3,4].map(i => <div key={i} className="h-4 skeleton rounded w-full" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-screen">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg glow-accent"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
      </button>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Lesson Sidebar */}
      <aside className={`fixed lg:relative top-0 right-0 lg:right-auto z-50 lg:z-auto h-full w-80 bg-sidebar border-l lg:border-l-0 lg:border-r border-border overflow-y-auto transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="p-4">
          {sequentialAccess ? (
            <Link
              href={courseCtxId ? `/courses/${courseCtxId}` : "/dashboard"}
              className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              К списку уроков
            </Link>
          ) : (
            <Link href="/dashboard" className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" />
              Назад к дашборду
            </Link>
          )}

          {sequentialAccess ? (
            <>
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Содержание урока</h3>
              <nav className="space-y-0.5">
                {toc.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => handleTocClick(i, item.id)}
                    className={`w-full flex items-start gap-2 text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer whitespace-normal leading-snug ${
                      paginated && i === safeBlock
                        ? "bg-accent/10 text-accent font-medium"
                        : "text-muted hover:text-foreground hover:bg-sidebar-hover"
                    }`}
                  >
                    <span className="text-xs opacity-60 shrink-0 mt-0.5">{i + 1}.</span>
                    <span className="flex-1">{item.text}</span>
                  </button>
                ))}
              </nav>
            </>
          ) : (
          <>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Оглавление</h3>

          <div className="space-y-1">
            {topics.map(topic => (
              <div key={topic.id}>
                <button
                  onClick={() => toggleTopic(topic.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
                >
                  {expandedTopics.has(topic.id) ? (
                    <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                  )}
                  <span className="flex-1 text-left whitespace-normal">{topic.title}</span>
                  <span className="ml-2 text-xs text-muted shrink-0">
                    {topic.lessons.filter(l => l.completed).length}/{topic.lessons.length}
                  </span>
                </button>

                 {expandedTopics.has(topic.id) && (
                  <div className="ml-4 pl-2 border-l border-border space-y-3 mb-2 mt-1">
                    {Object.entries(
                      topic.lessons.reduce((acc, l) => {
                        const block = l.block_name || "";
                        if (!acc[block]) acc[block] = [];
                        acc[block].push(l);
                        return acc;
                      }, {} as Record<string, typeof topic.lessons>)
                    ).map(([blockName, blockLessons]) => (
                      <div key={blockName} className="space-y-1">
                        {blockName && (
                          <div className="px-2 py-0.5 text-[9px] font-bold text-accent/80 bg-accent/5 rounded uppercase tracking-wider select-none">
                            {blockName}
                          </div>
                        )}
                        <div className="space-y-0.5">
                          {blockLessons.map(l => (
                            <Link
                              key={l.id}
                              href={`/lessons/${l.id}${courseHref}`}
                              onClick={() => setSidebarOpen(false)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                                l.id === lessonId
                                  ? 'bg-accent/10 text-accent font-medium'
                                  : 'text-muted hover:text-foreground hover:bg-sidebar-hover'
                              }`}
                            >
                              {l.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                              ) : l.id === lessonId ? (
                                <Play className="w-4 h-4 text-accent shrink-0" />
                              ) : (
                                <Circle className="w-4 h-4 shrink-0" />
                              )}
                              <span className="flex-1 text-left whitespace-normal">{l.title}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div ref={contentScrollRef} className="flex-1 overflow-y-auto animate-fade-in">
        <div className="max-w-3xl mx-auto p-4 lg:p-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted mb-6">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Дашборд</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="hover:text-foreground transition-colors">{lesson.topic.title}</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground">{lesson.title}</span>
          </div>

          {/* Lesson Header */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-3">{lesson.title}</h1>
              {isAdmin && (
                <button
                  onClick={() => setEditMode((v) => !v)}
                  className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    editMode
                      ? "bg-accent text-accent-foreground border-accent"
                      : "text-muted border-border hover:text-foreground hover:bg-card-hover"
                  }`}
                >
                  {editMode ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                  {editMode ? "Готово" : "Редактировать"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted">
              {lesson.duration_minutes > 0 && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {formatDuration(lesson.duration_minutes)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                {lesson.topic.title}
              </span>
            </div>
          </div>

          {/* Specialty Filter — only for prompt engineering lessons with tagged content */}
          {hasSpecialtyContent && (
            <div className="mb-6 p-4 rounded-xl bg-card border border-border">
              <SpecialtyFilter
                onChange={setSelectedSpecialty}
                className="!p-0"
              />
              <p className="text-xs text-muted mt-2">
                💡 Примеры промптов адаптируются под выбранную специальность
              </p>
            </div>
          )}

          {/* Block indicator (paginated sequential courses) */}
          {paginated && (
            <div className="flex items-center gap-2 text-xs font-semibold text-accent uppercase tracking-wider mb-4">
              <span>Блок {safeBlock + 1} из {blocks.length}</span>
            </div>
          )}

          {/* Content — plain markdown segments, or a file/quiz/video embed for
              any segment that is a lone <!-- FILE/QUIZ/VIDEO --> marker */}
          {displayContent && (
            <div className="prose-dark mb-8">
              {editing ? (
                <>
                  <InsertImageRow onClick={() => handleInsertPick(-1)} disabled={screenshotUploading} />
                  {segments.map((seg, i) => (
                    <Fragment key={i}>
                      {renderSegment(seg)}
                      <InsertImageRow onClick={() => handleInsertPick(i)} disabled={screenshotUploading} />
                    </Fragment>
                  ))}
                </>
              ) : (
                segments.map((seg, i) => <Fragment key={i}>{renderSegment(seg)}</Fragment>)
              )}
            </div>
          )}

          {/* Mark Complete — always (non-paginated) or on the last block (paginated) */}
          {(!paginated || safeBlock === blocks.length - 1) && (
            <div className="border-t border-border pt-6 mb-8">
              <button
                onClick={handleToggleComplete}
                disabled={progressLoading}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer ${
                  isCompleted
                    ? 'bg-success/10 text-success border border-success/20 hover:bg-success/20'
                    : 'bg-accent text-accent-foreground hover:bg-accent-hover glow-accent'
                }`}
              >
                {progressLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
                {isCompleted ? "Урок пройден" : "Отметить как пройденное"}
              </button>
            </div>
          )}

          {/* Navigation */}
          {paginated ? (
            <div className="flex items-center justify-between gap-3 pb-8">
              <button
                onClick={() => {
                  if (safeBlock > 0) setActiveBlock(safeBlock - 1);
                  else if (prevLesson) router.push(`/lessons/${prevLesson.id}${courseHref}`);
                }}
                disabled={safeBlock === 0 && !prevLesson}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-muted hover:text-foreground hover:bg-card-hover border border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{safeBlock > 0 ? "Предыдущий блок" : "Прошлый урок"}</span>
                <span className="sm:hidden">Назад</span>
              </button>

              <span className="text-xs text-muted shrink-0">{safeBlock + 1} / {blocks.length}</span>

              {safeBlock < blocks.length - 1 ? (
                <button
                  onClick={() => setActiveBlock(safeBlock + 1)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 transition-colors cursor-pointer"
                >
                  <span className="hidden sm:inline">Следующий блок</span>
                  <span className="sm:hidden">Далее</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : nextLesson ? (
                <Link
                  href={`/lessons/${nextLesson.id}${courseHref}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 transition-colors"
                >
                  <span className="hidden sm:inline">Следующий урок</span>
                  <span className="sm:hidden">Далее</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-accent text-accent-foreground hover:bg-accent-hover transition-colors glow-accent"
                >
                  Завершить курс
                  <CheckCircle2 className="w-4 h-4" />
                </Link>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between pb-8">
              {prevLesson ? (
                <Link
                  href={`/lessons/${prevLesson.id}${courseHref}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-muted hover:text-foreground hover:bg-card-hover border border-border transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">{prevLesson.title}</span>
                  <span className="sm:hidden">Назад</span>
                </Link>
              ) : <div />}

              {nextLesson ? (
                <Link
                  href={`/lessons/${nextLesson.id}${courseHref}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 transition-colors"
                >
                  <span className="hidden sm:inline">{nextLesson.title}</span>
                  <span className="sm:hidden">Далее</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-accent text-accent-foreground hover:bg-accent-hover transition-colors glow-accent"
                >
                  Завершить курс
                  <CheckCircle2 className="w-4 h-4" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hidden input for inline admin screenshot upload */}
      <input
        ref={screenshotInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleScreenshotChange}
      />

      {/* Image Lightbox Modal */}
      {activeImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setActiveImage(null)}
        >
          <button
            onClick={() => setActiveImage(null)}
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="max-w-6xl max-h-[90vh] relative animate-scale-up">
            <img
              src={activeImage}
              alt="Увеличенное изображение"
              className="rounded-xl object-contain max-h-[85vh] max-w-full shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
