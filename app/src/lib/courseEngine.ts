import type { Lesson } from '../types/lesson';

export const LAYER_NAMES: Record<1 | 2 | 3, string> = {
  1: 'AI 入門（淺）',
  2: '生活應用（中）',
  3: '進階玩法（深）',
};

export function isLayerCompleted(lessons: Lesson[], layer: number, completedLessonIds: string[]): boolean {
  const layerLessons = lessons.filter((l) => l.layer === layer);
  return layerLessons.length > 0 && layerLessons.every((l) => completedLessonIds.includes(l.id));
}

export function isLayerUnlocked(layer: number, lessons: Lesson[], completedLessonIds: string[]): boolean {
  if (layer <= 1) return true;
  return isLayerCompleted(lessons, layer - 1, completedLessonIds);
}

export function getLessonState(
  lesson: Lesson,
  lessons: Lesson[],
  completedLessonIds: string[],
): 'locked' | 'available' | 'completed' {
  if (completedLessonIds.includes(lesson.id)) return 'completed';
  if (!isLayerUnlocked(lesson.layer, lessons, completedLessonIds)) return 'locked';
  return 'available';
}

export function getNextLesson(lessons: Lesson[], completedLessonIds: string[]): Lesson | null {
  // The standalone (layer 0) anti-fraud lesson is reachable any time via its own
  // always-unlocked section/button — it's not part of the "next lesson" rotation
  // through the main 3-tier curriculum.
  const curriculum = lessons.filter((l) => l.layer >= 1);
  return curriculum.find((l) => getLessonState(l, lessons, completedLessonIds) === 'available') ?? null;
}
