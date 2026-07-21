"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TOPIC_GRADIENTS } from "@/lib/constants";
import { useToast } from "@/components/shared/toast-provider";
import { ArrowLeft, Save, Loader2, Upload, X } from "lucide-react";
import Link from "next/link";
import CourseStructureEditor from "@/components/admin/course-structure-editor";

export default function NewCoursePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [gradient, setGradient] = useState<string>(TOPIC_GRADIENTS[0]);
  const [sequentialAccess, setSequentialAccess] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { addToast } = useToast();
  const editId = searchParams.get("edit");

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка загрузки");

      setImageUrl(json.url);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Не удалось загрузить картинку", "error");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (editId) {
      setIsEditing(true);
      setCurrentCourseId(editId);
      const fetchData = async () => {
        const { data } = await supabase.from("courses").select("*").eq("id", editId).single();
        if (data) {
          setTitle(data.title);
          setDescription(data.description || "");
          setImageUrl(data.image_url || "");
          setGradient(data.gradient);
          setSequentialAccess(data.sequential_access);
          setIsPublished(data.is_published);
        }
      };
      fetchData();
    }
  }, [editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const data = {
      title,
      description,
      image_url: imageUrl || null,
      gradient,
      sequential_access: sequentialAccess,
      is_published: isPublished,
    };

    try {
      if (isEditing && currentCourseId) {
        const { error } = await supabase.from("courses").update(data).eq("id", currentCourseId);
        if (error) throw error;
        addToast("Курс сохранён", "success");
        setLoading(false);
      } else {
        const { data: created, error } = await supabase.from("courses").insert(data).select("id").single();
        if (error || !created) throw error;
        // Stay on the page so the structure editor (topics + lessons) unlocks
        // immediately, without a second save.
        setIsEditing(true);
        setCurrentCourseId(created.id);
        router.replace(`/admin/courses/new?edit=${created.id}`);
        setLoading(false);
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Ошибка сохранения курса", "error");
      setLoading(false);
    }
  };

  return (
    <div>
      <Link href="/admin/courses" className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />Назад к курсам
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-8">{isEditing ? "Редактировать курс" : "Новый курс"}</h1>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Название</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Например: Управление командой" required className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground placeholder:text-muted-foreground transition-colors" />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Описание</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Краткое описание курса..." rows={3} className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground placeholder:text-muted-foreground transition-colors resize-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Обложка (необязательно)</label>
          {imageUrl && (
            <div className="relative w-full h-36 rounded-xl overflow-hidden border border-border mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Обложка курса" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImageUrl("")}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 text-foreground hover:text-error transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://... или загрузите файл" className="flex-1 px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground placeholder:text-muted-foreground transition-colors" />
            <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors shrink-0 ${uploading ? "bg-input text-muted cursor-wait" : "bg-input border border-border text-foreground hover:border-accent cursor-pointer"}`}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Загрузка…" : "Загрузить"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleCoverUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-xs text-muted mt-1.5">PNG, JPEG, WEBP или GIF, до 10 МБ. PDF не поддерживается — сохраните нужную страницу как картинку и загрузите её.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Цвет карточки</label>
          <div className="flex flex-wrap gap-2">
            {TOPIC_GRADIENTS.map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGradient(g)}
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${g} transition-all cursor-pointer ${gradient === g ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100"}`}
                aria-label={g}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setSequentialAccess(!sequentialAccess)} className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${sequentialAccess ? "bg-accent" : "bg-border"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${sequentialAccess ? "translate-x-5" : ""}`} />
          </button>
          <div>
            <label className="text-sm text-foreground block">Последовательный доступ</label>
            <p className="text-xs text-muted">Следующий урок открывается только после прохождения предыдущего</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setIsPublished(!isPublished)} className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${isPublished ? "bg-accent" : "bg-border"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isPublished ? "translate-x-5" : ""}`} />
          </button>
          <label className="text-sm text-foreground">Опубликовать</label>
        </div>

        <button type="submit" disabled={loading || !title} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-foreground font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer glow-accent">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEditing ? "Сохранить" : "Создать"}
        </button>
      </form>

      {isEditing && currentCourseId ? (
        <div className="mt-10 pt-8 border-t border-border max-w-2xl">
          <h2 className="text-lg font-semibold text-foreground mb-1">Структура курса</h2>
          <p className="text-sm text-muted mb-4">Добавьте темы, задайте их порядок, и внутри каждой выберите нужные уроки и порядок их прохождения.</p>
          <CourseStructureEditor courseId={currentCourseId} />
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted max-w-2xl">Сохраните курс, чтобы настроить его структуру (темы и уроки).</p>
      )}
    </div>
  );
}
