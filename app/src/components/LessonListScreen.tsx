import type { Lesson } from '../types/lesson';
import { LAYER_NAMES, getLessonState } from '../lib/courseEngine';

interface LessonListScreenProps {
  lessons: Lesson[];
  completedLessonIds: string[];
  onSelectLesson: (lessonId: string) => void;
}

const LAYERS: (1 | 2 | 3)[] = [1, 2, 3];
const LAYER_NUMERAL = ['一', '二', '三'];

export function LessonListScreen({ lessons, completedLessonIds, onSelectLesson }: LessonListScreenProps) {
  const standaloneLessons = lessons.filter((l) => l.layer === 0);

  return (
    <div className="screen">
      <div className="topbar">
        <h2>📖 上堂</h2>
        <p>揀一課，慢慢學</p>
      </div>
      {LAYERS.map((layer) => {
        const layerLessons = lessons.filter((l) => l.layer === layer);
        return (
          <div className="prog-card" key={layer}>
            <h4>
              第{LAYER_NUMERAL[layer - 1]}層 · {LAYER_NAMES[layer]}
            </h4>
            {layerLessons.length === 0 && <p className="prog-num">未有課程</p>}
            {layerLessons.map((lesson) => {
              const state = getLessonState(lesson, lessons, completedLessonIds);
              const icon = state === 'locked' ? '🔒' : state === 'completed' ? '✅' : '▶️';
              return (
                <button
                  key={lesson.id}
                  className={`lesson-row${state === 'locked' ? ' locked' : ''}`}
                  disabled={state === 'locked'}
                  onClick={() => onSelectLesson(lesson.id)}
                >
                  <span className="l-ico">{icon}</span>
                  <span>{lesson.subtitle}</span>
                </button>
              );
            })}
          </div>
        );
      })}
      <div className="prog-card">
        <h4>🛡️ 防騙必修班</h4>
        {standaloneLessons.length === 0 && <p className="prog-num">快將推出</p>}
        {standaloneLessons.map((lesson) => {
          const state = getLessonState(lesson, lessons, completedLessonIds);
          const icon = state === 'completed' ? '✅' : '▶️';
          return (
            <button key={lesson.id} className="lesson-row" onClick={() => onSelectLesson(lesson.id)}>
              <span className="l-ico">{icon}</span>
              <span>{lesson.subtitle}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
