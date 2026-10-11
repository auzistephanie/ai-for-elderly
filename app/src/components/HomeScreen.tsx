import type { Lesson } from '../types/lesson';

interface HomeScreenProps {
  nextLesson: Lesson | null;
  antiFraudLesson: Lesson | null;
  streakCount: number;
  displayName?: string | null;
  now?: Date;
  onSelectLesson: (lessonId: string) => void;
}

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return '早晨';
  if (hour < 18) return '午安';
  return '晚安';
}

export function HomeScreen({
  nextLesson,
  antiFraudLesson,
  streakCount,
  displayName,
  now,
  onSelectLesson,
}: HomeScreenProps) {
  const name = displayName?.trim();
  return (
    <div className="screen">
      <div className="greet">
        <div className="hello">
          {greetingFor(now ?? new Date())}
          {name ? `，${name}` : ''} 👋
        </div>
        <div className="sub">今日想學啲咩？</div>
      </div>
      {nextLesson ? (
        <div
          className="today-card"
          role="button"
          tabIndex={0}
          onClick={() => onSelectLesson(nextLesson.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectLesson(nextLesson.id);
            }
          }}
        >
          <div className="label">📅 今日新課</div>
          <h3>{nextLesson.subtitle}</h3>
          <div className="go">開始上堂 ▶</div>
        </div>
      ) : (
        <div className="today-card">
          <div className="label">🎉 今層學晒喇</div>
          <h3>去「上堂」揀下一層，或者試下防騙必修班</h3>
        </div>
      )}
      <div className="home-btns">
        <button
          className="bigbtn"
          style={{ background: '#fdecec', color: '#a33' }}
          disabled={!antiFraudLesson}
          onClick={() => antiFraudLesson && onSelectLesson(antiFraudLesson.id)}
        >
          <span className="ico">🛡️</span>
          <span>
            防騙必修班
            <small>{antiFraudLesson ? antiFraudLesson.title : '快將推出'}</small>
          </span>
        </button>
      </div>
      <div className="streak-strip">
        {streakCount > 0 ? (
          <>
            🔥 連續學咗 <b style={{ color: '#d9822b', fontSize: 26 }}>&nbsp;{streakCount}&nbsp;</b> 日，好叻呀！
          </>
        ) : (
          <>🔥 今日學一課，就係你嘅第 1 日！</>
        )}
      </div>
    </div>
  );
}
