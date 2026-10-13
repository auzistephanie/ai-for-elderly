import { visibleLessonText } from './visibleLessonText';
import type { DemoStep, WhyStep } from '../types/lesson';

describe('visibleLessonText', () => {
  it('reads the on-screen why copy, not a divergent speak script (lesson-002)', () => {
    const step: WhyStep = {
      kind: 'why',
      title: '點解要識 AI？',
      body: [
        '你有冇試過想查啲嘢，又唔知問邊個？',
        '或者想搵人傾偈，但又怕煩到人？',
        'AI 就好似一個好有禮貌嘅幫手，',
        '你問佢，佢就會答你，仲唔會嫌你煩㗎！',
      ],
      speak: 'AI 係一個可以幫你解答問題、陪你傾偈嘅智能朋友，學識用佢，生活就方便好多喇。',
    };

    const spoken = visibleLessonText(step);

    expect(spoken).toBe(
      [
        '點解要識 AI？',
        '你有冇試過想查啲嘢，又唔知問邊個？',
        '或者想搵人傾偈，但又怕煩到人？',
        'AI 就好似一個好有禮貌嘅幫手，',
        '你問佢，佢就會答你，仲唔會嫌你煩㗎！',
      ].join('\n'),
    );
    expect(spoken).not.toContain('智能朋友');
  });

  it('reads the demo bubbles and caption in on-screen order, not the speak caption', () => {
    const step: DemoStep = {
      kind: 'demo',
      title: '同 AI 傾偈係咁簡單',
      bubbles: [
        { speaker: 'user', text: '你好，我想問今日天氣點樣？' },
        { speaker: 'ai', text: '你好呀！今日天氣晴朗，溫度大約25度，好適合出去散步㗎！' },
      ],
      body: ['睇吓點樣同 AI 開場對話啦！'],
      speak: '你睇，就咁問一句，AI 就好快答到你，係咪好方便呢？',
    };

    expect(visibleLessonText(step)).toBe(
      [
        '同 AI 傾偈係咁簡單',
        '你好，我想問今日天氣點樣？',
        '你好呀！今日天氣晴朗，溫度大約25度，好適合出去散步㗎！',
        '睇吓點樣同 AI 開場對話啦！',
      ].join('\n'),
    );
  });
});
