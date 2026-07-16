import type { ScreenName } from '../types/screen';

const TABS: { name: ScreenName; icon: string; label: string }[] = [
  { name: 'home', icon: '🏠', label: '主頁' },
  { name: 'lesson', icon: '📖', label: '上堂' },
  { name: 'progress', icon: '🌱', label: '進度' },
  { name: 'family', icon: '👨‍👩‍👧', label: '家人' },
];

interface NavBarProps {
  active: ScreenName;
  onNavigate: (name: ScreenName) => void;
}

export function NavBar({ active, onNavigate }: NavBarProps) {
  return (
    <nav className="navbar">
      {TABS.map((tab) => (
        <button
          key={tab.name}
          className={`nav-item${active === tab.name ? ' on' : ''}`}
          onClick={() => onNavigate(tab.name)}
        >
          <span className="n-ico">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
