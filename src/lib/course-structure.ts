import type {
  Course,
  CourseTopic,
  CourseTopicLesson,
  CourseWithTopics,
  Lesson,
  Topic,
  TopicWithProgress,
} from "@/types";

interface RawStructure {
  courses: Course[];
  courseTopics: CourseTopic[];
  courseTopicLessons: CourseTopicLesson[];
  topics: Topic[];
  lessons: Lesson[];
  completedIds?: Set<string>;
}

// Assemble the flat join-table rows into the ordered course → topic → lesson
// tree the UI consumes. Topics are ordered by course_topics.sort_order; within
// each, only the lessons the course selected are included, ordered by
// course_topic_lessons.sort_order. Shared by useCourses and the course/lesson pages.
export function buildCourseTree({
  courses,
  courseTopics,
  courseTopicLessons,
  topics,
  lessons,
  completedIds = new Set(),
}: RawStructure): CourseWithTopics[] {
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const lessonById = new Map(lessons.map((l) => [l.id, l]));

  // course_topic_id -> ordered lessons the course includes
  const lessonsByCourseTopic = new Map<string, Lesson[]>();
  for (const ctl of [...courseTopicLessons].sort((a, b) => a.sort_order - b.sort_order)) {
    const lesson = lessonById.get(ctl.lesson_id);
    if (!lesson) continue; // unpublished / filtered out
    const arr = lessonsByCourseTopic.get(ctl.course_topic_id) || [];
    arr.push(lesson);
    lessonsByCourseTopic.set(ctl.course_topic_id, arr);
  }

  // course_id -> ordered TopicWithProgress
  const topicsByCourse = new Map<string, TopicWithProgress[]>();
  for (const ct of [...courseTopics].sort((a, b) => a.sort_order - b.sort_order)) {
    const baseTopic = topicById.get(ct.topic_id);
    if (!baseTopic) continue;
    const topicLessons = lessonsByCourseTopic.get(ct.id) || [];
    const completedLessons = topicLessons.filter((l) => completedIds.has(l.id)).length;
    const twp: TopicWithProgress = {
      ...baseTopic,
      course_topic_id: ct.id,
      sort_order: ct.sort_order,
      block_name: ct.block_name,
      lessons: topicLessons,
      totalLessons: topicLessons.length,
      completedLessons,
    };
    const arr = topicsByCourse.get(ct.course_id) || [];
    arr.push(twp);
    topicsByCourse.set(ct.course_id, arr);
  }

  return courses.map((course) => {
    const courseTopicsList = topicsByCourse.get(course.id) || [];
    return {
      ...course,
      topics: courseTopicsList,
      totalTopics: courseTopicsList.length,
      completedTopics: courseTopicsList.filter(
        (t) => t.totalLessons > 0 && t.completedLessons === t.totalLessons
      ).length,
    };
  });
}

// The course's lessons flattened in learning order (topics in order, lessons in
// order within each). Basis for sequential gating.
export function flattenCourseLessons(course: CourseWithTopics): Lesson[] {
  return course.topics.flatMap((t) => t.lessons);
}

// For a sequential course, a lesson is unlocked when it's first in the course
// order or the immediately-preceding lesson is completed. Non-sequential
// courses and admins have everything unlocked.
export function isLessonUnlocked(
  course: CourseWithTopics,
  lessonId: string,
  completedIds: Set<string>,
  isAdmin: boolean
): boolean {
  if (isAdmin || !course.sequential_access) return true;
  const flat = flattenCourseLessons(course);
  const idx = flat.findIndex((l) => l.id === lessonId);
  if (idx <= 0) return true; // first lesson (or not found) is open
  return completedIds.has(flat[idx - 1].id);
}
