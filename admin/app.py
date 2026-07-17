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


def fetch_pending_lessons():
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/elder_lessons",
        headers=HEADERS,
        params={"status": "eq.pending", "order": "layer.asc,number.asc", "select": "*"},
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


st.set_page_config(page_title="AI老友記 - 課堂審批", layout="wide")
st.title("AI老友記 · 待審批課堂")

pending = fetch_pending_lessons()

if not pending:
    st.info("而家冇 pending 課堂。")

for lesson in pending:
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
        if col1.button("✅ Approve", key=f"approve-{lesson['id']}"):
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
                st.error(f"呢啲欄唔可以留空，未 approve：{'、'.join(blank_fields)}")
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
                st.success(f"已 approve：{subtitle}")
                st.rerun()

        if col2.button("❌ Reject（刪除）", key=f"reject-{lesson['id']}"):
            delete_lesson(lesson["id"])
            st.warning(f"已刪除：{subtitle}")
            st.rerun()
