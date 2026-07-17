import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Lesson } from '../types/lesson';
import { LessonListScreen } from './LessonListScreen';

function makeLesson(id: string, layer: 0 | 1 | 2 | 3, number: number, subtitle: string): Lesson {
  return {
    id,
    layer,
    number,
    title: `title-${id}`,
    subtitle,
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

describe('LessonListScreen', () => {
  const lessons = [makeLesson('l1', 1, 1, '第一課'), makeLesson('l2', 2, 1, '第二層課'), makeLesson('af', 0, 1, '防騙課')];

  it('shows an available layer-1 lesson as tappable', async () => {
    const onSelectLesson = vi.fn();
    render(<LessonListScreen lessons={lessons} completedLessonIds={[]} onSelectLesson={onSelectLesson} />);
    const row = screen.getByText('第一課').closest('button')!;
    expect(row).not.toBeDisabled();
    await userEvent.click(row);
    expect(onSelectLesson).toHaveBeenCalledWith('l1');
  });

  it('shows a locked layer-2 lesson as disabled and not clickable', () => {
    render(<LessonListScreen lessons={lessons} completedLessonIds={[]} onSelectLesson={() => {}} />);
    const row = screen.getByText('第二層課').closest('button')!;
    expect(row).toBeDisabled();
    expect(row).toHaveClass('locked');
  });

  it('unlocks layer 2 once layer 1 is fully completed', () => {
    render(<LessonListScreen lessons={lessons} completedLessonIds={['l1']} onSelectLesson={() => {}} />);
    expect(screen.getByText('第二層課').closest('button')).not.toBeDisabled();
  });

  it('always shows the standalone anti-fraud lesson as tappable, regardless of layer progress', async () => {
    const onSelectLesson = vi.fn();
    render(<LessonListScreen lessons={lessons} completedLessonIds={[]} onSelectLesson={onSelectLesson} />);
    const row = screen.getByText('防騙課').closest('button')!;
    expect(row).not.toBeDisabled();
    await userEvent.click(row);
    expect(onSelectLesson).toHaveBeenCalledWith('af');
  });

  it('marks a completed lesson with a checkmark icon', () => {
    render(<LessonListScreen lessons={lessons} completedLessonIds={['l1']} onSelectLesson={() => {}} />);
    expect(screen.getByText('第一課').closest('button')).toHaveTextContent('✅');
  });
});
