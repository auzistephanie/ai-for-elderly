import { useEffect, useState } from 'react';
import type { Lesson } from '../types/lesson';
import { SpeakButton } from './SpeakButton';
import { logLessonStart } from '../lib/lessonStarts';
import { getGeminiAppStoreInfo } from '../lib/appStoreLinks';

interface LessonScreenProps {
  lesson: Lesson;
  userId: string;
  onComplete: () => void;
  completeError?: string | null;
}

export function LessonScreen({ lesson, userId, onComplete, completeError }: LessonScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  useEffect(() => {
    // Best-effort analytics: a failed write here must never block the lesson itself, and
    // there's nothing actionable for the user to do about it, so it's silently swallowed
    // rather than shown as an error (unlike user-initiated actions elsewhere in this app).
    logLessonStart(userId, lesson.id).catch(() => {});
  }, [lesson.id, userId]);

  const step = lesson.steps[stepIndex];
  const quizStep = step.kind === 'quiz' ? step : null;
  const answeredCorrect =
    quizStep !== null && selectedOption !== null && quizStep.options[selectedOption].correct;

  const isFirstLesson = lesson.layer === 1 && lesson.number === 1;
  const appStoreInfo = getGeminiAppStoreInfo(navigator.userAgent, navigator.maxTouchPoints);

  return (
    <div className="screen">
      <div className="topbar">
        <h2>📖 {lesson.title}</h2>
        <p>{lesson.subtitle}</p>
      </div>
      <div className="lesson-body">
        <div className="step-pill">
          第 {stepIndex + 1} 步 / 共 {lesson.steps.length} 步{step.kind === 'quiz' ? ' · 考下你' : ''}
        </div>
        <h3>{step.title}</h3>

        {step.kind === 'why' && (
          <>
            {step.body.map((p, i) => (
              <p className="talk" key={i}>{p}</p>
            ))}
            <SpeakButton text={step.speak} />
            <button className="bigbtn next-btn" onClick={() => setStepIndex((i) => i + 1)}>
              <span>下一步 ▶</span>
            </button>
          </>
        )}

        {step.kind === 'demo' && (
          <>
            {isFirstLesson && (
              <div className="gemini-card">
                <div className="ico">✨</div>
                <h4>今堂要用返 Gemini App</h4>
                <p>好多手機已經有裝，冇裝嘅撳低面掣攞返一個，完全免費。</p>
                <a className="get-app-btn" href={appStoreInfo.url}>
                  {appStoreInfo.label}
                </a>
              </div>
            )}
            <div className="gemini-shell">
              <div className="gemini-header">
                <span>✨</span>
                <span>Gemini</span>
              </div>
              <div className="demo-box">
                {step.bubbles.map((b, i) => (
                  <div key={i} className={b.speaker === 'user' ? 'bubble-user' : 'bubble-ai'}>
                    {b.text}
                  </div>
                ))}
              </div>
              <div className="gemini-input-bar" aria-hidden="true">
                <span className="icon">📷</span>
                <div className="field" />
                <span className="icon">🎤</span>
              </div>
            </div>
            {step.body.map((p, i) => (
              <p className="talk" key={i}>{p}</p>
            ))}
            <SpeakButton text={step.speak} />
            <button className="bigbtn next-btn" onClick={() => setStepIndex((i) => i + 1)}>
              <span>下一步 ▶</span>
            </button>
          </>
        )}

        {quizStep && (
          <>
            {quizStep.options.map((opt, i) => {
              const isSelected = selectedOption === i;
              const stateClass = isSelected ? (opt.correct ? ' correct' : ' wrong') : '';
              return (
                <button
                  key={i}
                  className={`bigbtn quiz-opt${stateClass}`}
                  onClick={() => setSelectedOption(i)}
                >
                  <span className="ico">{isSelected ? (opt.correct ? '✅' : '❌') : '⬜'}</span>
                  <span>{opt.text}</span>
                </button>
              );
            })}
            {selectedOption !== null && (
              <div
                className="quiz-feedback"
                style={{ color: answeredCorrect ? '#2f6f4f' : '#d9534f' }}
              >
                {answeredCorrect ? quizStep.feedbackCorrect : quizStep.feedbackWrong}
              </div>
            )}
            {answeredCorrect && (
              <>
                {completeError && <p className="error-text">{completeError}</p>}
                <button className="bigbtn next-btn" onClick={onComplete}>
                  <span>完成課堂 🎉</span>
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
