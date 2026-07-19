import os

import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


def fetch_published_lessons():
    # 2026-07-19 修：以前呢度揾 status=eq.pending——但 `scripts/generate_lessons.py`
    # 2026-07-19 改咗做直接寫 status='published'（Stephanie 決定跳過逐課審批），
    # 由嗰日起就再冇任何 row 會係 pending，呢個工具永遠揾唔到嘢，等於冇咗個
    # 事後補救網（該檔 docstring 明文話「admin/Streamlit app 仍然存在，畀
    # retroactively 睇/改/落架已發佈課堂」——而家先真係做到呢個角色）。
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/elder_lessons",
        headers=HEADERS,
        params={"status": "eq.published", "order": "layer.asc,number.asc", "select": "*"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def update_lesson(lesson_id, patch):
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/elder_lessons",
        headers=HEADERS,
        params={"id": f"eq.{lesson_id}"},
        json=patch,
        timeout=15,
    )
    resp.raise_for_status()


def delete_lesson(lesson_id):
    resp = requests.delete(
        f"{SUPABASE_URL}/rest/v1/elder_lessons",
        headers=HEADERS,
        params={"id": f"eq.{lesson_id}"},
        timeout=15,
    )
    resp.raise_for_status()


def fetch_lesson_analytics():
    lessons_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/elder_lessons",
        headers=HEADERS,
        params={"select": "id,subtitle,layer,number", "order": "layer.asc,number.asc"},
        timeout=15,
    )
    lessons_resp.raise_for_status()
    lessons = lessons_resp.json()

    starts_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/elder_lesson_starts",
        headers=HEADERS,
        params={"select": "user_id,lesson_id"},
        timeout=15,
    )
    starts_resp.raise_for_status()
    starts = starts_resp.json()

    completions_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/elder_lesson_completions",
        headers=HEADERS,
        params={"select": "user_id,lesson_id"},
        timeout=15,
    )
    completions_resp.raise_for_status()
    completions = completions_resp.json()

    started_by_lesson = {}
    for row in starts:
        started_by_lesson.setdefault(row["lesson_id"], set()).add(row["user_id"])

    completed_by_lesson = {}
    for row in completions:
        completed_by_lesson.setdefault(row["lesson_id"], set()).add(row["user_id"])

    result = []
    for lesson in lessons:
        lid = lesson["id"]
        started = len(started_by_lesson.get(lid, set()))
        completed = len(completed_by_lesson.get(lid, set()))
        result.append(
            {
                "課堂": lesson["subtitle"],
                "層": lesson["layer"],
                "開咗（不重複人數）": started,
                "完成咗": completed,
                "未完成": max(0, started - completed),
            }
        )
    return result


st.set_page_config(page_title="AI老友記 - 課堂管理", layout="wide")
st.title("AI老友記 · 已發佈課堂（睇/改/落架）")
st.caption("課堂而家由 generate_lessons.py 直接發佈，冇逐課審批呢一步——呢個工具改做事後補救：睇返已發佈嘅內容，發現問題可以隨時改或者落架。")

st.header("📊 課堂開始/完成統計")
st.dataframe(fetch_lesson_analytics(), use_container_width=True)

published = fetch_published_lessons()

if not published:
    st.info("而家冇已發佈課堂。")

for lesson in published:
    with st.expander(f"[第{lesson['layer']}層 #{lesson['number']}] {lesson['subtitle']}"):
        title = st.text_input("標題", value=lesson["title"], key=f"title-{lesson['id']}")
        subtitle = st.text_input("副標題", value=lesson["subtitle"], key=f"subtitle-{lesson['id']}")

        steps = lesson["steps"]
        why_step, demo_step, quiz_step = steps[0], steps[1], steps[2]

        st.subheader("Step 1 · 點解要學")
        why_body = st.text_area("內容（每行一段）", value="\n".join(why_step["body"]), key=f"why-body-{lesson['id']}")
        why_speak = st.text_area("讀出嚟文字", value=why_step["speak"], key=f"why-speak-{lesson['id']}")

        st.subheader("Step 2 · 睇示範")
        demo_bubbles_text = "\n".join(f"{b['speaker']}: {b['text']}" for b in demo_step["bubbles"])
        st.text(demo_bubbles_text)
        demo_body = st.text_area("內容（每行一段）", value="\n".join(demo_step["body"]), key=f"demo-body-{lesson['id']}")
        demo_speak = st.text_area("讀出嚟文字", value=demo_step["speak"], key=f"demo-speak-{lesson['id']}")

        st.subheader("Step 3 · 考一考")
        quiz_title = st.text_input("題目", value=quiz_step["title"], key=f"quiz-title-{lesson['id']}")
        opt_a = st.text_input("選項 A", value=quiz_step["options"][0]["text"], key=f"opt-a-{lesson['id']}")
        opt_b = st.text_input("選項 B", value=quiz_step["options"][1]["text"], key=f"opt-b-{lesson['id']}")
        correct_option = st.radio(
            "邊個岩",
            ["A", "B"],
            index=0 if quiz_step["options"][0]["correct"] else 1,
            key=f"correct-{lesson['id']}",
        )
        feedback_correct = st.text_input("答啱嘅回應", value=quiz_step["feedbackCorrect"], key=f"fb-correct-{lesson['id']}")
        feedback_wrong = st.text_input("答錯嘅回應", value=quiz_step["feedbackWrong"], key=f"fb-wrong-{lesson['id']}")

        col1, col2 = st.columns(2)
        if col1.button("💾 儲存修改", key=f"save-{lesson['id']}"):
            required_fields = {
                "標題": title,
                "副標題": subtitle,
                "Step 1 讀出嚟文字": why_speak,
                "Step 2 讀出嚟文字": demo_speak,
                "題目": quiz_title,
                "選項 A": opt_a,
                "選項 B": opt_b,
                "答啱嘅回應": feedback_correct,
                "答錯嘅回應": feedback_wrong,
            }
            blank_fields = [name for name, value in required_fields.items() if not value.strip()]
            if blank_fields:
                st.error(f"呢啲欄唔可以留空，未儲存：{'、'.join(blank_fields)}")
            else:
                new_steps = [
                    {**why_step, "body": why_body.split("\n"), "speak": why_speak},
                    {**demo_step, "body": demo_body.split("\n"), "speak": demo_speak},
                    {
                        **quiz_step,
                        "title": quiz_title,
                        "options": [
                            {"text": opt_a, "correct": correct_option == "A"},
                            {"text": opt_b, "correct": correct_option == "B"},
                        ],
                        "feedbackCorrect": feedback_correct,
                        "feedbackWrong": feedback_wrong,
                    },
                ]
                update_lesson(
                    lesson["id"],
                    {"title": title, "subtitle": subtitle, "steps": new_steps, "status": "published"},
                )
                st.success(f"已儲存：{subtitle}")
                st.rerun()

        if col2.button("🗑 落架（刪除）", key=f"unpublish-{lesson['id']}"):
            delete_lesson(lesson["id"])
            st.warning(f"已落架：{subtitle}")
            st.rerun()
