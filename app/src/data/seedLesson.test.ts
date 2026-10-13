import { seedLesson } from './seedLesson';

describe('seedLesson', () => {
  it('has exactly a why-step, a demo-step, and a quiz-step in order', () => {
    expect(seedLesson.steps.map((s) => s.kind)).toEqual(['why', 'demo', 'quiz']);
  });

  it('quiz has exactly one correct option', () => {
    const correctCount = seedLesson.steps[2].options.filter((o) => o.correct).length;
    expect(correctCount).toBe(1);
  });

  it('belongs to layer 1 so it is reachable with no prior progress', () => {
    expect(seedLesson.layer).toBe(1);
  });
});
