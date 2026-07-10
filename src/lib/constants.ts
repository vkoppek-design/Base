export const APP_NAME = "Veronika Koppek";
export const APP_DESCRIPTION = "Платформа для развития управленческих навыков: команда, коммуникация и мотивация";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  LESSON: (id: string) => `/lessons/${id}`,
  ADMIN: "/admin",
  ADMIN_TOPICS: "/admin/topics",
  ADMIN_TOPICS_NEW: "/admin/topics/new",
  ADMIN_LESSONS: "/admin/lessons",
  ADMIN_LESSONS_NEW: "/admin/lessons/new",
  ADMIN_COURSES: "/admin/courses",
  ADMIN_COURSES_NEW: "/admin/courses/new",
} as const;

export const TOPIC_ICONS: Record<string, string> = {
  "prompt-engineering": "MessageSquareText",
  "ai-agents": "Bot",
  "visual-content": "Image",
  "vibe-coding": "Code",
} as const;

export const TOPIC_GRADIENTS = [
  "from-[#185658] to-[#0D3A3B]",
  "from-cyan-400 to-blue-500",
  "from-violet-400 to-purple-500",
  "from-[#EEC72F] to-[#C9A423]",
  "from-rose-400 to-pink-500",
  "from-teal-400 to-green-500",
] as const;
