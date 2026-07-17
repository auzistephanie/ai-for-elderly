import type { Lesson } from '../types/lesson';

interface HomeScreenProps {
  nextLesson: Lesson | null;
  antiFraudLesson: Lesson | null;
  streakCount: number;
  onSelectLesson: (lessonId: string) => void;
}

export function HomeScreen({ nextLesson, antiFraudLesson, streakCount, onSelectLesson }: HomeScreenProps) {
  return (
    <div className="screen">
      <div className="greet">
        <div className="hello">早晨 👋</div>
        <div className="sub">今日想學啲咩？</div>
      </div>
      {nextLesson ? (
        <div className="today-card" onClick={() => onSelectLesson(nextLesson.id)}>
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
          style={{ background: '#fdf4dd', color: '#8a6d1a' }}
          disabled={!nextLesson}
          onClick={() => nextLesson && onSelectLesson(nextLesson.id)}
        >
          <span className="ico">📖</span>
          <span>
            上堂
            <small>{nextLesson ? nextLesson.title : '暫時得閒'}</small>
          </span>
        </button>
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
        <button className="bigbtn" style={{ background: '#eef5fc', color: '#2a5d8f' }} disabled>
          <span className="ico">📞</span>
          <span>
            唔識就撳我
            <small>快將推出</small>
          </span>
        </button>
      </div>
      <div className="streak-strip">
        🔥 連續學咗 <b style={{ color: '#d9822b', fontSize: 26 }}>&nbsp;{streakCount}&nbsp;</b> 日，好叻呀！
      </div>
    </div>
  );
}
