import type { DemoStep, WhyStep } from '../types/lesson';

/**
 * 組出「讀出嚟俾我聽」要讀嘅字：同畫面渲染嘅課堂正文同一來源。
 *
 * 唔讀 `step.speak`。已發佈課堂入面嗰欄會同畫面脫節（例如 lesson-002
 * 畫面寫「你有冇試過想查啲嘢…」，speak 卻係另一句「AI 係一個可以幫你解答問題…」）。
 *
 * 順序跟畫面：標題 →（示範步）對話氣泡 → 正文段落。
 * 步驟標籤、按鈕字、Gemini 安裝卡唔算課堂正文，唔讀。
 */
export function visibleLessonText(step: WhyStep | DemoStep): string {
  const parts: string[] = [step.title];
  if (step.kind === 'demo') {
    parts.push(...step.bubbles.map((bubble) => bubble.text));
  }
  parts.push(...step.body);
  return parts.filter((part) => part.trim().length > 0).join('\n');
}
