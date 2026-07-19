"""Generates the Plan 3 seed-lesson drafts via DeepSeek and writes them into
Supabase's elder_lessons table as status='published' -- live immediately,
no manual review gate (Stephanie's call, 2026-07-19: she trusts DeepSeek's
output enough to skip the old per-lesson approval step). The admin/
Streamlit app still exists for retroactively viewing/editing/unpublishing
a lesson after the fact, it's just no longer a required gate before publish.

Manually triggered only (see ../.github/workflows/generate-lessons.yml,
workflow_dispatch) -- this script does not run on any recurring schedule.

Must stay Python-3.9-compatible (no `X | Y` union type hints, no `match`
statements) -- this project's local dev machine runs Python 3.9.6.
"""

import json
import os
import re
import sys
from typing import Any, Dict, List

import requests

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

SCENARIOS: List[Dict[str, Any]] = [
    {"id": "lesson-002", "layer": 1, "number": 1, "topic": "AI 係咩 —— 長者第一次接觸 AI，建立親近感，唔使驚"},
    {"id": "lesson-003", "layer": 1, "number": 2, "topic": "點同 AI 讲嘢 —— 打字問 AI 問題嘅基本技巧"},
    {"id": "lesson-004", "layer": 1, "number": 3, "topic": "語音輸入 —— 唔使打字，撳一下用把口同 AI 講嘢"},
    {"id": "lesson-005", "layer": 2, "number": 5, "topic": "睇唔明嘅信影相翻譯 —— 政府信、銀行信用相機問 AI 解讀"},
    {"id": "lesson-006", "layer": 2, "number": 6, "topic": "寫祝壽詞/心意卡 —— 請 AI 幫手作賀詞、心意卡文字"},
    {"id": "lesson-007", "layer": 2, "number": 7, "topic": "搵食譜 —— 憑手上材料問 AI 應該煮咩餸"},
    {"id": "lesson-008", "layer": 2, "number": 8, "topic": "同 AI 傾偈解悶 —— 得閒可以搵 AI 傾偈"},
    {"id": "lesson-009", "layer": 3, "number": 9, "topic": "AI 執靚張相 —— 用 AI 修圖、美化相片"},
    {"id": "lesson-010", "layer": 3, "number": 10, "topic": "計劃旅行 —— 用 AI 幫手諗行程"},
    {"id": "lesson-011", "layer": 3, "number": 11, "topic": "幫手覆 WhatsApp —— 用 AI 幫手諗點覆訊息"},
    {
        "id": "lesson-012",
        "layer": 0,
        "number": 1,
        "topic": "防騙班：AI假電話／deepfake點認 —— 認清 AI 詐騙手法（呢課獨立、隨時可以學，唔受層級解鎖限制）",
    },
]

SYSTEM_PROMPT = """你係「AI老友記」呢個教香港長者（60-72歲）用 AI 嘅 app 嘅課堂設計師。
每一課要跟呢個固定結構：
1. why 步：解釋「點解要學呢樣嘢」，一段生活化嘅口語解釋 + 生活痛點。
2. demo 步：模擬一個 user 同 AI 嘅對話 demo（user bubble + AI bubble）。
3. quiz 步：1 條二選一嘅選擇題，答啱先算完成，答錯有溫柔提示再試。

語氣規則（唔可以妥協）：
- 全部用廣東話口語，唔好用書面語/普通話用詞。
- 鼓勵性語氣，當用家係精明大人，唔好居高臨下。
- 每句盡量短，啱畀 22px 大字顯示，唔好一大段長文字。

輸出格式：淨係輸出一個 JSON object，唔好有其他文字或者 markdown code fence，形狀如下：
{
  "title": "string，例如「第 2 課」",
  "subtitle": "string，一句講呢課學咩",
  "steps": [
    {"kind": "why", "title": "string", "body": ["string", "string"], "speak": "string"},
    {"kind": "demo", "title": "string", "bubbles": [{"speaker": "user", "text": "string"}, {"speaker": "ai", "text": "string"}], "body": ["string"], "speak": "string"},
    {"kind": "quiz", "title": "string", "options": [{"text": "string", "correct": true}, {"text": "string", "correct": false}], "feedbackCorrect": "string", "feedbackWrong": "string"}
  ]
}
"""


def build_prompt(scenario: Dict[str, Any]) -> str:
    return f"呢一課嘅場景係：{scenario['topic']}\n\n請跟返 system prompt 嘅結構同格式，生成呢一課嘅內容。"


def call_deepseek(scenario: Dict[str, Any], api_key: str) -> str:
    response = requests.post(
        DEEPSEEK_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_prompt(scenario)},
            ],
            "temperature": 0.7,
        },
        timeout=60,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


_FENCE_RE = re.compile(r"^```[ \t]*([a-zA-Z0-9_+-]*)[ \t]*\r?\n(.*)\n?```[ \t]*$", re.DOTALL)


def _strip_markdown_fence(text: str) -> str:
    """Strips a leading/trailing ``` or ```json code fence, if present.

    Only strips the fence when it wraps the *entire* text (leading ``` and a
    trailing ```) so we don't accidentally mangle real JSON content that
    happens to contain backticks. Handles a bare ``` fence (no language tag)
    as well as ```json, and tolerates trailing whitespace after the closing
    fence.
    """
    stripped = text.strip()
    match = _FENCE_RE.match(stripped)
    if match:
        return match.group(2).strip()
    return stripped


def parse_lesson_response(raw_text: str, scenario: Dict[str, Any]) -> Dict[str, Any]:
    text = _strip_markdown_fence(raw_text)

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"AI 回應唔係合法 JSON：{exc}\n原文：{raw_text}") from exc

    for field in ("title", "subtitle", "steps"):
        if field not in data:
            raise ValueError(f"AI 回應缺少 '{field}' 欄位：{data}")

    steps = data["steps"]
    if len(steps) != 3:
        raise ValueError(f"steps 應該係 3 步，實際係 {len(steps)} 步：{steps}")

    if steps[0].get("kind") != "why":
        raise ValueError(f"第 1 步應該係 'why'，實際係 {steps[0].get('kind')}")
    if steps[1].get("kind") != "demo":
        raise ValueError(f"第 2 步應該係 'demo'，實際係 {steps[1].get('kind')}")
    if steps[2].get("kind") != "quiz":
        raise ValueError(f"第 3 步應該係 'quiz'，實際係 {steps[2].get('kind')}")

    quiz_options = steps[2].get("options", [])
    if len(quiz_options) != 2:
        raise ValueError(f"quiz options 應該係 2 個，實際係 {len(quiz_options)} 個：{quiz_options}")
    correct_count = sum(1 for opt in quiz_options if opt.get("correct") is True)
    if correct_count != 1:
        raise ValueError(f"quiz options 應該啱好有 1 個 correct=true，實際有 {correct_count} 個：{quiz_options}")

    return {
        "id": scenario["id"],
        "layer": scenario["layer"],
        "number": scenario["number"],
        "title": data["title"],
        "subtitle": data["subtitle"],
        "steps": steps,
        "status": "published",
    }


def insert_lesson(lesson: Dict[str, Any], supabase_url: str, service_role_key: str) -> None:
    response = requests.post(
        f"{supabase_url}/rest/v1/elder_lessons",
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=lesson,
        timeout=15,
    )
    try:
        response.raise_for_status()
    except requests.exceptions.HTTPError as exc:
        # Supabase/PostgREST puts the actually-useful detail (e.g. a
        # duplicate-primary-key conflict on a partial re-run) in the response
        # body, not in the HTTPError's default str(). Surface it explicitly
        # so a batch failure log line is actionable instead of just "409
        # Client Error: Conflict for url: ...".
        raise requests.exceptions.HTTPError(
            f"{exc}\nSupabase 回應內容：{response.text}", response=response
        ) from exc


def main() -> int:
    deepseek_key = os.environ["DEEPSEEK_API_KEY"]
    supabase_url = os.environ["SUPABASE_URL"]
    service_role_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    failures = []
    for scenario in SCENARIOS:
        print(f"生成緊：{scenario['id']} — {scenario['topic']}")
        try:
            raw = call_deepseek(scenario, deepseek_key)
            lesson = parse_lesson_response(raw, scenario)
            insert_lesson(lesson, supabase_url, service_role_key)
            # 2026-07-19 修：呢個 script 頂部 docstring 講明而家寫 status='published'
            # 即時發佈（唔再經 pending 審批），但落面呢兩句 log 之前仲寫住「pending」，
            # 睇 console/CI log 會誤導人以為課堂仲喺審批隊列等緊人手 approve。
            print(f"  已寫入（published）：{lesson['subtitle']}")
        except Exception as exc:  # one bad scenario must not stop the whole batch
            print(f"  失敗：{exc}")
            failures.append(scenario["id"])

    if failures:
        print(f"\n{len(failures)} 課生成失敗：{failures}")
        return 1

    print(f"\n全部 {len(SCENARIOS)} 課都成功寫入（即時發佈，冇 pending 審批）。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
