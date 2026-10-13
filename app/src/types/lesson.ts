export interface DemoBubble {
  speaker: 'user' | 'ai';
  text: string;
}

export interface WhyStep {
  kind: 'why';
  title: string;
  body: string[];
  /**
   * 舊 TTS 稿。2026-10-13 起課堂畫面已刪走朗讀掣，app 唔再讀呢欄。
   * 留低係等已發佈 JSON 唔使改 schema。
   */
  speak: string;
}

export interface DemoStep {
  kind: 'demo';
  title: string;
  bubbles: DemoBubble[];
  body: string[];
  /** 同 WhyStep.speak：已停用嘅舊 TTS 稿，畫面唔再讀。 */
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
  layer: 0 | 1 | 2 | 3;
  number: number;
  title: string;
  subtitle: string;
  steps: [WhyStep, DemoStep, QuizStep];
}
