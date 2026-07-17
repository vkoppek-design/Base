"use client";

import { Fragment } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseLessonContent } from "@/lib/lesson-content";
import { getYouTubeEmbedUrl } from "@/lib/utils";
import { LessonFileBlock } from "@/components/lesson/lesson-materials";
import { QuizSection } from "@/components/lesson/quiz-section";

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

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "text":
            return (
              <div key={i} className="prose-dark mb-8">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
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
