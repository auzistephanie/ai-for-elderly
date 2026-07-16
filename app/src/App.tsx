import { useState } from 'react';
import { NavBar } from './components/NavBar';
import { HomeScreen } from './components/HomeScreen';
import { LessonScreen } from './components/LessonScreen';
import { ProgressScreen } from './components/ProgressScreen';
import { FamilyScreen } from './components/FamilyScreen';
import { seedLesson } from './data/seedLesson';
import { useProgress, computeBadges } from './hooks/useProgress';
import type { ScreenName } from './types/screen';

export function App() {
  const [screen, setScreen] = useState<ScreenName>('home');
  const { state, completeLesson, setFamilyShare } = useProgress();

  const layer1Total = 1; // only seedLesson exists until Plan 3 adds more content
  const layer1Completed = state.completedLessonIds.includes(seedLesson.id) ? 1 : 0;

  const badges = computeBadges({
    completedCount: state.completedLessonIds.length,
    streakCount: state.streakCount,
    antiFraudDone: false, // 防騙必修班 has no content yet (Home shows it as "快將推出")
    allLayersDone: false, // layers 2/3 have zero lessons until later plans
  });

  return (
    <div className="app">
      {screen === 'home' && (
        <HomeScreen
          todayLesson={seedLesson}
          streakCount={state.streakCount}
          onStartLesson={() => setScreen('lesson')}
        />
      )}
      {screen === 'lesson' && (
        <LessonScreen
          lesson={seedLesson}
          onComplete={() => {
            completeLesson(seedLesson.id);
            setScreen('progress');
          }}
        />
      )}
      {screen === 'progress' && (
        <ProgressScreen
          layers={[
            { layer: 1, name: 'AI 入門（淺）', totalLessons: layer1Total, completedLessons: layer1Completed },
            { layer: 2, name: '生活應用（中）', totalLessons: 0, completedLessons: 0 },
            { layer: 3, name: '進階玩法（深）', totalLessons: 0, completedLessons: 0 },
          ]}
          badges={badges}
        />
      )}
      {screen === 'family' && (
        <FamilyScreen shareEnabled={state.familyShareEnabled} onToggleShare={setFamilyShare} />
      )}
      <NavBar active={screen} onNavigate={setScreen} />
    </div>
  );
}
