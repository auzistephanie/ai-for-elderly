import { useState } from 'react';
import type { Lesson } from '../types/lesson';
import { SpeakButton } from './SpeakButton';

interface LessonScreenProps {
  lesson: Lesson;
  onComplete: () => void;
}

export function LessonScreen({ lesson, onComplete }: LessonScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const step = lesson.steps[stepIndex];
  const quizStep = step.kind === 'quiz' ? step : null;
  const answeredCorrect =
    quizStep !== null && selectedOption !== null && quizStep.options[selectedOption].correct;

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
            <div className="demo-box">
              {step.bubbles.map((b, i) => (
                <div key={i} className={b.speaker === 'user' ? 'bubble-user' : 'bubble-ai'}>
                  {b.text}
                </div>
              ))}
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
                  <span className="ico">{opt.correct ? '✅' : '❌'}</span>
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
              <button className="bigbtn next-btn" onClick={onComplete}>
                <span>完成課堂 🎉</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
