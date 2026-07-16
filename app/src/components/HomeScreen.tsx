import type { Lesson } from '../types/lesson';

interface HomeScreenProps {
  todayLesson: Lesson;
  streakCount: number;
  onStartLesson: () => void;
}

export function HomeScreen({ todayLesson, streakCount, onStartLesson }: HomeScreenProps) {
  return (
    <div className="screen">
      <div className="greet">
        <div className="hello">早晨 👋</div>
        <div className="sub">今日想學啲咩？</div>
      </div>
      <div className="today-card" onClick={onStartLesson}>
        <div className="label">📅 今日新課</div>
        <h3>{todayLesson.subtitle}</h3>
        <div className="go">開始上堂 ▶</div>
      </div>
      <div className="home-btns">
        <button
          className="bigbtn"
          style={{ background: '#fdf4dd', color: '#8a6d1a' }}
          onClick={onStartLesson}
        >
          <span className="ico">📖</span>
          <span>
            上堂
            <small>{todayLesson.title}</small>
          </span>
        </button>
        <button className="bigbtn" style={{ background: '#fdecec', color: '#a33' }} disabled>
          <span className="ico">🛡️</span>
          <span>
            防騙必修班
            <small>快將推出</small>
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
