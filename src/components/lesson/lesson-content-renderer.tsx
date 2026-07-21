"use client";

import { Fragment } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseLessonContent } from "@/lib/lesson-content";
import { getYouTubeEmbedUrl } from "@/lib/utils";
import { LessonFileBlock } from "@/components/lesson/lesson-materials";
import { QuizSection } from "@/components/lesson/quiz-section";

// Renders `![label|width](url)` images at their stored width — mirrors the
// student lesson page so the preview matches exactly.
const imgRenderer: Partial<Components> = {
  img: ({ src, alt }) => {
    const altStr = typeof alt === "string" ? alt : "";
    const m = altStr.match(/\|(\d+)\s*$/);
    const width = m ? Math.min(100, Math.max(10, parseInt(m[1], 10))) : 100;
    const label = altStr.replace(/\|\d+\s*$/, "").trim() || "Изображение";
    return (
      <span className="block my-4 text-center">
        <img
          src={typeof src === "string" ? src : ""}
          alt={label}
          style={{ width: `${width}%`, maxWidth: "100%", display: "block", marginLeft: "auto", marginRight: "auto" }}
          className="rounded-xl"
        />
      </span>
    );
  },
};

// Renders a lesson's stored Markdown (with inline <!-- FILE/QUIZ/VIDEO -->
// markers) as an ordered sequence of text, file, quiz, and video blocks.
// Shared by the student lesson page and the admin preview page so both
// stay pixel-identical.
export function LessonContentRenderer({
  content,
  lessonId,
  markdownComponents,
}: {
  content: string | null;
  lessonId: string;
  markdownComponents?: Partial<Components>;
}) {
  const blocks = parseLessonContent(content);
  const components = { ...imgRenderer, ...markdownComponents };

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "text":
            return (
              <div key={i} className="prose-dark mb-8">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                  {block.markdown}
                </ReactMarkdown>
              </div>
            );
          case "video": {
            const embedUrl = getYouTubeEmbedUrl(block.url) || block.url;
            return (
              <div key={i} className="mb-8 rounded-2xl overflow-hidden border border-border bg-card">
                <div className="aspect-video">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Видео урока"
                  />
                </div>
              </div>
            );
          }
          case "file":
            return (
              <Fragment key={i}>
                <LessonFileBlock attachmentId={block.attachmentId} />
              </Fragment>
            );
          case "quiz":
            return (
              <Fragment key={i}>
                <QuizSection lessonId={lessonId} quizId={block.quizId} />
              </Fragment>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
