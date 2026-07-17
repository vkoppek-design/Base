import type { LessonBlock } from "@/types";

type MarkerBlock = Exclude<LessonBlock, { type: "text" }>;

const MARKER_RE = /^<!--\s*(FILE|QUIZ|VIDEO):(.*?)\s*-->$/;

// Checks whether a single (trimmed) line is a FILE/QUIZ/VIDEO marker and, if
// so, returns the corresponding block. Exposed separately from
// parseLessonContent so callers that already split content into segments by
// blank lines (e.g. the student lesson page's screenshot-insertion feature)
// can classify each segment without re-implementing the marker syntax.
export function parseMarkerLine(line: string): MarkerBlock | null {
  const match = line.trim().match(MARKER_RE);
  if (!match) return null;
  const [, kind, value] = match;
  if (kind === "FILE") return { type: "file", attachmentId: value };
  if (kind === "QUIZ") return { type: "quiz", quizId: value };
  return { type: "video", url: value };
}

// Splits a lesson's stored Markdown into an ordered sequence of text and
// embed blocks. A marker must occupy its own line to be recognized.
export function parseLessonContent(content: string | null): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  const lines = (content || "").split(/\r?\n/);
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) blocks.push({ type: "text", markdown: text });
    buffer = [];
  };

  for (const line of lines) {
    const marker = parseMarkerLine(line);
    if (marker) {
      flush();
      blocks.push(marker);
    } else {
      buffer.push(line);
    }
  }
  flush();
  return blocks;
}

// Reverse of parseLessonContent — used when saving from the rich editor.
export function serializeLessonBlocks(blocks: LessonBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "text":
          return b.markdown;
        case "file":
          return `<!-- FILE:${b.attachmentId} -->`;
        case "quiz":
          return `<!-- QUIZ:${b.quizId} -->`;
        case "video":
          return `<!-- VIDEO:${b.url} -->`;
      }
    })
    .join("\n\n");
}

// Used server-side to prove a quiz is legitimately embedded in a lesson
// before serving its questions (quizzes have no FK to a lesson — a lesson
// only references one via a <!-- QUIZ:id --> marker).
export function lessonReferencesQuiz(content: string | null, quizId: string): boolean {
  return parseLessonContent(content).some((b) => b.type === "quiz" && b.quizId === quizId);
}
