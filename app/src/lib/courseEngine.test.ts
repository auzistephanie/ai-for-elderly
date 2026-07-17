import type { Lesson } from '../types/lesson';
import { isLayerCompleted, isLayerUnlocked, getLessonState, getNextLesson, LAYER_NAMES } from './courseEngine';

function makeLesson(id: string, layer: 0 | 1 | 2 | 3, number: number): Lesson {
  return {
    id,
    layer,
    number,
    title: `title-${id}`,
    subtitle: `subtitle-${id}`,
    steps: [
      { kind: 'why', title: 'W', body: ['x'], speak: 's' },
      { kind: 'demo', title: 'D', bubbles: [], body: ['x'], speak: 's' },
      {
        kind: 'quiz',
        title: 'Q',
        options: [
          { text: 'A', correct: true },
          { text: 'B', correct: false },
        ],
        feedbackCorrect: 'yes',
        feedbackWrong: 'no',
      },
    ],
  };
}

describe('isLayerCompleted', () => {
  it('is false when the layer has no lessons at all', () => {
    expect(isLayerCompleted([], 1, [])).toBe(false);
  });

  it('is false when some lessons in the layer are not completed', () => {
    const lessons = [makeLesson('l1', 1, 1), makeLesson('l2', 1, 2)];
    expect(isLayerCompleted(lessons, 1, ['l1'])).toBe(false);
  });

  it('is true when every lesson in the layer is completed', () => {
    const lessons = [makeLesson('l1', 1, 1), makeLesson('l2', 1, 2)];
    expect(isLayerCompleted(lessons, 1, ['l1', 'l2'])).toBe(true);
  });
});

describe('isLayerUnlocked', () => {
  const lessons = [makeLesson('l1', 1, 1), makeLesson('l2', 2, 1)];

  it('layer 0 (standalone) is always unlocked', () => {
    expect(isLayerUnlocked(0, lessons, [])).toBe(true);
  });

  it('layer 1 is always unlocked', () => {
    expect(isLayerUnlocked(1, lessons, [])).toBe(true);
  });

  it('layer 2 is locked until layer 1 is fully completed', () => {
    expect(isLayerUnlocked(2, lessons, [])).toBe(false);
    expect(isLayerUnlocked(2, lessons, ['l1'])).toBe(true);
  });

  it('layer 3 is locked until layer 2 is fully completed', () => {
    const withL3 = [...lessons, makeLesson('l3', 3, 1)];
    expect(isLayerUnlocked(3, withL3, ['l1'])).toBe(false);
    expect(isLayerUnlocked(3, withL3, ['l1', 'l2'])).toBe(true);
  });
});

describe('getLessonState', () => {
  const lessons = [makeLesson('l1', 1, 1), makeLesson('l2', 2, 1)];

  it('returns completed when the lesson id is in completedLessonIds', () => {
    expect(getLessonState(lessons[1], lessons, ['l2'])).toBe('completed');
  });

  it("returns locked when the lesson's layer is not unlocked yet", () => {
    expect(getLessonState(lessons[1], lessons, [])).toBe('locked');
  });

  it('returns available when the layer is unlocked and the lesson is not yet completed', () => {
    expect(getLessonState(lessons[0], lessons, [])).toBe('available');
    expect(getLessonState(lessons[1], lessons, ['l1'])).toBe('available');
  });
});

describe('getNextLesson', () => {
  it('returns the first available layer-1-or-above lesson in order', () => {
    const lessons = [makeLesson('l1', 1, 1), makeLesson('l2', 1, 2)];
    expect(getNextLesson(lessons, [])?.id).toBe('l1');
    expect(getNextLesson(lessons, ['l1'])?.id).toBe('l2');
  });

  it('excludes the standalone layer-0 lesson from the rotation', () => {
    const lessons = [makeLesson('standalone', 0, 1), makeLesson('l1', 1, 1)];
    expect(getNextLesson(lessons, [])?.id).toBe('l1');
  });

  it('returns null once every unlocked lesson is completed', () => {
    const lessons = [makeLesson('l1', 1, 1)];
    expect(getNextLesson(lessons, ['l1'])).toBeNull();
  });
});

describe('LAYER_NAMES', () => {
  it('has display names for layers 1-3', () => {
    expect(LAYER_NAMES[1]).toBe('AI 入門（淺）');
    expect(LAYER_NAMES[2]).toBe('生活應用（中）');
    expect(LAYER_NAMES[3]).toBe('進階玩法（深）');
  });
});
