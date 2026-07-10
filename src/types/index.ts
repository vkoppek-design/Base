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

export interface UserLessonAccess {
  id: string;
  user_id: string;
  lesson_id: string;
  granted_by: string | null;
  created_at: string;
}

export interface Topic {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  icon: string;
  gradient: string;
  sort_order: number;
  block_name: string | null;
  is_published: boolean;
  created_at: string;
}

export interface Lesson {
  id: string;
  topic_id: string;
  title: string;
  content: string | null;
  video_url: string | null;
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

export interface TopicWithProgress extends Topic {
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
  lesson_id: string;
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
