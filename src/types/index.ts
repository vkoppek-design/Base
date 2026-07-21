export type UserRole = "admin" | "student";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  role: UserRole;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  gradient: string;
  is_published: boolean;
  sequential_access: boolean;
  created_at: string;
}

export interface UserCourse {
  id: string;
  user_id: string;
  course_id: string;
  granted_by: string | null;
  created_at: string;
}

// A topic is now a course-independent, reusable grouping of lessons. Its
// order/placement within a course lives on `course_topics`, and which of its
// lessons a course includes (and in what order) lives on `course_topic_lessons`.
export interface Topic {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  gradient: string;
  is_published: boolean;
  created_at: string;
}

export interface CourseTopic {
  id: string;
  course_id: string;
  topic_id: string;
  sort_order: number;
  block_name: string | null;
  created_at: string;
}

export interface CourseTopicLesson {
  id: string;
  course_topic_id: string;
  lesson_id: string;
  sort_order: number;
}

export interface Lesson {
  id: string;
  topic_id: string | null;
  title: string;
  content: string | null;
  sort_order: number;
  duration_minutes: number;
  block_name: string | null;
  is_published: boolean;
  created_at: string;
}

export interface Progress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  completed_at: string;
  created_at: string;
}

// A topic as it appears inside a specific course: carries the course-scoped
// ordering/grouping (from course_topics) plus the ordered subset of lessons
// the course includes (from course_topic_lessons).
export interface TopicWithProgress extends Topic {
  course_topic_id: string;
  sort_order: number;
  block_name: string | null;
  lessons: Lesson[];
  completedLessons: number;
  totalLessons: number;
}

export interface CourseWithTopics extends Course {
  topics: TopicWithProgress[];
  completedTopics: number;
  totalTopics: number;
}

export interface LessonWithProgress extends Lesson {
  topic: Topic;
  completed: boolean;
}

export interface LessonAttachment {
  id: string;
  lesson_id: string;
  title: string;
  file_url: string;
  file_name: string | null;
  sort_order: number;
  created_at: string;
}

export type QuizQuestionType = "single" | "multiple";

export interface Quiz {
  id: string;
  title: string | null;
  created_at: string;
}

export interface QuizOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  sort_order: number;
}

// Client-facing option shape — never carries `is_correct`.
export type QuizOptionPublic = Omit<QuizOption, "is_correct">;

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question: string;
  question_type: QuizQuestionType;
  sort_order: number;
  options: QuizOption[];
}

export interface QuizQuestionPublic {
  id: string;
  quiz_id: string;
  question: string;
  question_type: QuizQuestionType;
  sort_order: number;
  options: QuizOptionPublic[];
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  total: number;
  answers: Record<string, string[]>;
  completed_at: string;
}

// A lesson's stored Markdown is split into this sequence for rendering —
// see src/lib/lesson-content.ts. `text` blocks are plain Markdown; the
// other three are inline embeds represented in storage as an HTML-comment
// marker on its own line (<!-- FILE:id -->, <!-- QUIZ:id -->, <!-- VIDEO:url -->).
export type LessonBlock =
  | { type: "text"; markdown: string }
  | { type: "file"; attachmentId: string }
  | { type: "quiz"; quizId: string }
  | { type: "video"; url: string };
