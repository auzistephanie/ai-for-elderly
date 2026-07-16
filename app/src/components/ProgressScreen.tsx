import type { Badge } from '../hooks/useProgress';

interface LayerInfo {
  layer: number;
  name: string;
  totalLessons: number;
  completedLessons: number;
}

interface ProgressScreenProps {
  layers: LayerInfo[];
  badges: Badge[];
}

const LAYER_NUMERAL = ['一', '二', '三'];

export function ProgressScreen({ layers, badges }: ProgressScreenProps) {
  return (
    <div className="screen">
      <div className="topbar">
        <h2>🌱 我嘅進度</h2>
        <p>一步一步嚟，唔使急</p>
      </div>
      {layers.map((layer) => {
        const pct =
          layer.totalLessons === 0 ? 0 : Math.round((layer.completedLessons / layer.totalLessons) * 100);
        const label =
          layer.totalLessons === 0
            ? '🔒 未有課程'
            : layer.completedLessons === layer.totalLessons
              ? `✅ 完成晒 ${layer.completedLessons} / ${layer.totalLessons} 課`
              : `學緊 ${layer.completedLessons} / ${layer.totalLessons} 課`;
        return (
          <div className="prog-card" key={layer.layer}>
            <h4>第{LAYER_NUMERAL[layer.layer - 1] ?? layer.layer}層 · {layer.name}</h4>
            <div
              className="prog-bar"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={label}
            >
              <div style={{ width: `${pct}%` }} />
            </div>
            <div className="prog-num">{label}</div>
          </div>
        );
      })}
      <div className="prog-card">
        <h4>我攞到嘅獎章</h4>
        <div className="badges">
          {badges.map((b) => (
            <div className={`badge${b.locked ? ' locked' : ''}`} key={b.id}>
              <div className="b-ico">{b.icon}</div>
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
