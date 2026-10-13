export interface DemoBubble {
  speaker: 'user' | 'ai';
  text: string;
}

export interface WhyStep {
  kind: 'why';
  title: string;
  body: string[];
  /**
   * 舊 TTS 稿。課堂畫面嘅「讀出嚟」唔再讀呢欄（同 body 脫過節），
   * 改讀 visibleLessonText。留低係等已發佈 JSON 唔使改 schema。
   */
  speak: string;
}

export interface DemoStep {
  kind: 'demo';
  title: string;
  bubbles: DemoBubble[];
  body: string[];
  /** 同 WhyStep.speak：畫面朗讀唔再用，見 visibleLessonText。 */
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
