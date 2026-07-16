export interface DemoBubble {
  speaker: 'user' | 'ai';
  text: string;
}

export interface WhyStep {
  kind: 'why';
  title: string;
  body: string[];
  speak: string;
}

export interface DemoStep {
  kind: 'demo';
  title: string;
  bubbles: DemoBubble[];
  body: string[];
  speak: string;
}

export interface QuizOption {
  text: string;
  correct: boolean;
}

export interface QuizStep {
  kind: 'quiz';
  title: string;
  options: [QuizOption, QuizOption];
  feedbackCorrect: string;
  feedbackWrong: string;
}

export interface Lesson {
  id: string;
  layer: 1 | 2 | 3;
  number: number;
  title: string;
  subtitle: string;
  steps: [WhyStep, DemoStep, QuizStep];
}
