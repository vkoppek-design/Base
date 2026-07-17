"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Markdown } from "tiptap-markdown";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/shared/toast-provider";
import { getYouTubeEmbedUrl } from "@/lib/utils";
import { parseLessonContent, serializeLessonBlocks } from "@/lib/lesson-content";
import type { LessonBlock } from "@/types";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  LinkIcon,
  FileText,
  ListChecks,
  Video,
  Trash2,
  Loader2,
  Plus,
  X,
  ImagePlus,
} from "lucide-react";

let localIdSeq = 0;
const nextLocalId = () => `blk-${++localIdSeq}`;

interface EditableBlock {
  localId: string;
  block: LessonBlock;
}

function toEditableBlocks(blocks: LessonBlock[]): EditableBlock[] {
  return blocks.length
    ? blocks.map((block) => ({ localId: nextLocalId(), block }))
    : [{ localId: nextLocalId(), block: { type: "text", markdown: "" } }];
}

function TextBlockToolbar({
  editor,
  onUploadImage,
  uploadingImage,
}: {
  editor: Editor | null;
  onUploadImage: () => void;
  uploadingImage: boolean;
}) {
  if (!editor) return null;
  const btn = (active: boolean) =>
    `p-1.5 rounded-lg transition-colors cursor-pointer ${active ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground hover:bg-card-hover"}`;
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border">
      <button type="button" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()} title="Жирный">
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button type="button" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()} title="Курсив">
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button type="button" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Заголовок">
        <Heading2 className="w-3.5 h-3.5" />
      </button>
      <button type="button" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Подзаголовок">
        <Heading3 className="w-3.5 h-3.5" />
      </button>
      <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Маркированный список">
        <List className="w-3.5 h-3.5" />
      </button>
      <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Нумерованный список">
        <ListOrdered className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className={btn(editor.isActive("link"))}
        onClick={() => {
          const url = window.prompt("Ссылка (URL):", editor.getAttributes("link").href || "");
          if (url === null) return;
          if (url === "") editor.chain().focus().unsetLink().run();
          else editor.chain().focus().setLink({ href: url }).run();
        }}
        title="Ссылка"
      >
        <LinkIcon className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-4 bg-border mx-1" />
      <button
        type="button"
        className={btn(false)}
        disabled={uploadingImage}
        onClick={onUploadImage}
        title="Вставить изображение"
      >
        {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function TextBlockEditor({ markdown, onChange }: { markdown: string; onChange: (markdown: string) => void }) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const supabase = createClient();
  const { addToast } = useToast();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Link.configure({ openOnClick: false }), Image, Markdown.configure({ html: false })],
    content: markdown,
    editorProps: {
      attributes: {
        class: "prose-dark min-h-[70px] px-4 py-3 outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange((editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown());
    },
  });

  const handleUploadImage = () => {
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingImage(true);
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
        editor.chain().focus().setImage({ src: json.url }).run();
      } catch (err) {
        addToast(err instanceof Error ? err.message : "Не удалось загрузить изображение", "error");
      } finally {
        setUploadingImage(false);
      }
    };
    input.click();
  };

  return (
    <div className="rounded-xl bg-input border border-border overflow-hidden">
      <TextBlockToolbar editor={editor} onUploadImage={handleUploadImage} uploadingImage={uploadingImage} />
      <EditorContent editor={editor} />
    </div>
  );
}

function InsertMenu({
  onInsertText,
  onInsertFile,
  onInsertVideo,
  onOpenQuizPicker,
  disabled,
}: {
  onInsertText: () => void;
  onInsertFile: () => void;
  onInsertVideo: (url: string) => void;
  onOpenQuizPicker: () => void;
  disabled: boolean;
}) {
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");

  return (
    <div className="flex items-center gap-2 py-2 relative">
      <div className="flex-1 h-px bg-border" />
      <button type="button" onClick={onInsertText} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted hover:text-foreground hover:bg-card-hover transition-colors cursor-pointer" title="Добавить текстовый блок">
        <Plus className="w-3 h-3" />
        Текст
      </button>
      <button
        type="button"
        onClick={onInsertFile}
        disabled={disabled}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted hover:text-foreground hover:bg-card-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        title={disabled ? "Сохраните урок, чтобы прикреплять файлы" : "Прикрепить файл"}
      >
        <FileText className="w-3 h-3" />
        Файл
      </button>
      <button
        type="button"
        onClick={onOpenQuizPicker}
        disabled={disabled}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted hover:text-foreground hover:bg-card-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        title={disabled ? "Сохраните урок, чтобы добавлять тесты" : "Добавить тест"}
      >
        <ListChecks className="w-3 h-3" />
        Тест
      </button>
      <button
        type="button"
        onClick={() => setVideoOpen((v) => !v)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted hover:text-foreground hover:bg-card-hover transition-colors cursor-pointer"
        title="Вставить видео"
      >
        <Video className="w-3 h-3" />
        Видео
      </button>
      <div className="flex-1 h-px bg-border" />

      {videoOpen && (
        <div className="absolute top-full right-0 z-20 mt-1 w-80 p-3 rounded-xl bg-card border border-border shadow-lg space-y-2">
          <input
            autoFocus
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Ссылка на YouTube-видео"
            className="w-full px-3 py-2 rounded-lg bg-input border border-border focus:border-accent outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setVideoOpen(false); setVideoUrl(""); }} className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-foreground cursor-pointer">
              Отмена
            </button>
            <button
              type="button"
              onClick={() => {
                if (!getYouTubeEmbedUrl(videoUrl)) {
                  alert("Не удалось распознать ссылку на YouTube");
                  return;
                }
                onInsertVideo(videoUrl.trim());
                setVideoOpen(false);
                setVideoUrl("");
              }}
              className="px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-medium hover:bg-accent-hover cursor-pointer"
            >
              Добавить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RichLessonEditor({
  value,
  onChange,
  lessonId,
}: {
  value: string;
  onChange: (markdown: string) => void;
  lessonId: string | null;
}) {
  const [editableBlocks, setEditableBlocks] = useState<EditableBlock[]>(() => toEditableBlocks(parseLessonContent(value)));
  const [attachmentTitles, setAttachmentTitles] = useState<Record<string, string>>({});
  const [quizTitles, setQuizTitles] = useState<Record<string, string>>({});
  const [uploadingAt, setUploadingAt] = useState<number | null>(null);
  const [quizPickerAt, setQuizPickerAt] = useState<number | null>(null);
  const [availableQuizzes, setAvailableQuizzes] = useState<{ id: string; title: string | null }[]>([]);
  const supabase = createClient();
  const { addToast } = useToast();

  // Fetch display titles for any file/quiz blocks present when loading an existing lesson.
  useEffect(() => {
    const fileIds = editableBlocks.filter((b) => b.block.type === "file").map((b) => (b.block as { attachmentId: string }).attachmentId);
    const quizIds = editableBlocks.filter((b) => b.block.type === "quiz").map((b) => (b.block as { quizId: string }).quizId);

    if (fileIds.length) {
      supabase
        .from("lesson_attachments")
        .select("id,title")
        .in("id", fileIds)
        .then(({ data }: { data: { id: string; title: string }[] | null }) => {
          if (data) setAttachmentTitles((prev) => ({ ...prev, ...Object.fromEntries(data.map((d) => [d.id, d.title])) }));
        });
    }
    if (quizIds.length) {
      supabase
        .from("quizzes")
        .select("id,title")
        .in("id", quizIds)
        .then(({ data }: { data: { id: string; title: string | null }[] | null }) => {
          if (data) setQuizTitles((prev) => ({ ...prev, ...Object.fromEntries(data.map((d) => [d.id, d.title || "Без названия"])) }));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = (next: EditableBlock[]) => {
    setEditableBlocks(next);
    onChange(serializeLessonBlocks(next.map((e) => e.block)));
  };

  const insertAt = (index: number, block: LessonBlock) => {
    const next = [...editableBlocks];
    next.splice(index + 1, 0, { localId: nextLocalId(), block });
    emit(next);
  };

  const updateText = (index: number, markdown: string) => {
    const next = [...editableBlocks];
    next[index] = { ...next[index], block: { type: "text", markdown } };
    setEditableBlocks(next);
    onChange(serializeLessonBlocks(next.map((e) => e.block)));
  };

  const removeAt = (index: number) => {
    const next = editableBlocks.filter((_, i) => i !== index);
    emit(next.length ? next : [{ localId: nextLocalId(), block: { type: "text", markdown: "" } }]);
  };

  const handleFileInsert = async (index: number, file: File, title: string) => {
    if (!lessonId) return;
    setUploadingAt(index);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload-file", {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка загрузки");

      const { data: attachment, error } = await supabase
        .from("lesson_attachments")
        .insert({ lesson_id: lessonId, title, file_url: json.url, file_name: json.name })
        .select("id,title")
        .single();
      if (error) throw error;

      setAttachmentTitles((prev) => ({ ...prev, [attachment.id]: attachment.title }));
      insertAt(index, { type: "file", attachmentId: attachment.id });
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Не удалось загрузить файл", "error");
    } finally {
      setUploadingAt(null);
    }
  };

  const openQuizPicker = async (index: number) => {
    const { data } = await supabase.from("quizzes").select("id,title").order("created_at", { ascending: false });
    setAvailableQuizzes(data || []);
    setQuizPickerAt(index);
  };

  return (
    <div className="space-y-0">
      {editableBlocks.map((eb, index) => (
        <div key={eb.localId}>
          {eb.block.type === "text" && <TextBlockEditor markdown={eb.block.markdown} onChange={(md) => updateText(index, md)} />}

          {eb.block.type === "file" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border">
              <FileText className="w-4 h-4 text-accent shrink-0" />
              <span className="flex-1 text-sm text-foreground truncate">{attachmentTitles[eb.block.attachmentId] || "Файл"}</span>
              <button type="button" onClick={() => removeAt(index)} className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {eb.block.type === "quiz" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border">
              <ListChecks className="w-4 h-4 text-accent shrink-0" />
              <span className="flex-1 text-sm text-foreground truncate">{quizTitles[eb.block.quizId] || "Тест"}</span>
              <button type="button" onClick={() => removeAt(index)} className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {eb.block.type === "video" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border">
              <Video className="w-4 h-4 text-accent shrink-0" />
              <span className="flex-1 text-sm text-foreground truncate">{eb.block.url}</span>
              <button type="button" onClick={() => removeAt(index)} className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {uploadingAt === index ? (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Загрузка файла…
            </div>
          ) : (
            <InsertMenu
              disabled={!lessonId}
              onInsertText={() => insertAt(index, { type: "text", markdown: "" })}
              onInsertVideo={(url) => insertAt(index, { type: "video", url })}
              onInsertFile={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.onchange = () => {
                  const file = input.files?.[0];
                  if (!file) return;
                  const title = window.prompt("Название файла (покажется студенту):", file.name) || file.name;
                  handleFileInsert(index, file, title);
                };
                input.click();
              }}
              onOpenQuizPicker={() => openQuizPicker(index)}
            />
          )}
        </div>
      ))}

      {quizPickerAt !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setQuizPickerAt(null)}>
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Выберите тест</h3>
              <button type="button" onClick={() => setQuizPickerAt(null)} className="p-1 text-muted hover:text-foreground cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {availableQuizzes.length === 0 ? (
              <p className="text-sm text-muted">
                Тестов пока нет.{" "}
                <a href="/admin/tests/new" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  Создать тест
                </a>{" "}
                в новой вкладке, затем обновите список.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {availableQuizzes.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setQuizTitles((prev) => ({ ...prev, [q.id]: q.title || "Без названия" }));
                      insertAt(quizPickerAt, { type: "quiz", quizId: q.id });
                      setQuizPickerAt(null);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-input border border-border hover:border-accent transition-colors text-sm text-foreground cursor-pointer"
                  >
                    {q.title || "Без названия"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
