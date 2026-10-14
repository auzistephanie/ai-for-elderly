import json
import unittest

from generate_lessons import SCENARIOS, build_prompt, parse_lesson_response

VALID_RESPONSE = {
    "title": "第 2 課",
    "subtitle": "AI 係咩",
    "steps": [
        {"kind": "why", "title": "W", "body": ["a", "b"], "speak": "s"},
        {
            "kind": "demo",
            "title": "D",
            "bubbles": [{"speaker": "user", "text": "u"}, {"speaker": "ai", "text": "a"}],
            "body": ["c"],
            "speak": "s2",
        },
        {
            "kind": "quiz",
            "title": "Q",
            "options": [{"text": "A", "correct": True}, {"text": "B", "correct": False}],
            "feedbackCorrect": "yes",
            "feedbackWrong": "no",
        },
    ],
}

SCENARIO = SCENARIOS[0]


class BuildPromptTests(unittest.TestCase):
    def test_includes_the_scenario_topic(self):
        prompt = build_prompt(SCENARIO)
        self.assertIn(SCENARIO["topic"], prompt)


class ParseLessonResponseTests(unittest.TestCase):
    def test_parses_a_well_formed_response(self):
        lesson = parse_lesson_response(json.dumps(VALID_RESPONSE), SCENARIO)
        self.assertEqual(lesson["id"], SCENARIO["id"])
        self.assertEqual(lesson["layer"], SCENARIO["layer"])
        self.assertEqual(lesson["number"], SCENARIO["number"])
        self.assertEqual(lesson["title"], "第 2 課")
        self.assertEqual(lesson["status"], "published")

    def test_keeps_the_stored_speak_field_without_rewriting_it(self):
        lesson = parse_lesson_response(json.dumps(VALID_RESPONSE), SCENARIO)
        self.assertEqual(lesson["steps"][0]["speak"], "s")
        self.assertEqual(lesson["steps"][1]["speak"], "s2")

    def test_strips_a_markdown_json_fence(self):
        fenced = "```json\n" + json.dumps(VALID_RESPONSE) + "\n```"
        lesson = parse_lesson_response(fenced, SCENARIO)
        self.assertEqual(lesson["subtitle"], "AI 係咩")

    def test_raises_on_invalid_json(self):
        with self.assertRaises(ValueError):
            parse_lesson_response("not json at all", SCENARIO)

    def test_parses_cjk_quotes_used_where_the_opening_ascii_quote_was_dropped(self):
        # 2026-07-17 run 29592803091, lesson-006: the model wrote
        # `"text": 「……」"` so json.loads died at the 「.
        payload = json.loads(json.dumps(VALID_RESPONSE))
        payload["steps"][1]["bubbles"][1]["text"] = "PLACEHOLDER"
        raw = json.dumps(payload, ensure_ascii=False, indent=2)
        greeting = "「親愛嘅媽咪，祝你長命百歲！」"
        raw = raw.replace('"PLACEHOLDER"', greeting + '"')
        lesson = parse_lesson_response(raw, SCENARIO)
        self.assertEqual(lesson["steps"][1]["bubbles"][1]["text"], greeting)

    def test_parses_cjk_quotes_used_as_the_string_delimiters(self):
        payload = json.loads(json.dumps(VALID_RESPONSE))
        payload["steps"][1]["bubbles"][1]["text"] = "PLACEHOLDER"
        raw = json.dumps(payload, ensure_ascii=False, indent=2)
        raw = raw.replace('"PLACEHOLDER"', "「你好」")
        lesson = parse_lesson_response(raw, SCENARIO)
        self.assertEqual(lesson["steps"][1]["bubbles"][1]["text"], "你好")

    def test_keeps_cjk_quotes_that_are_already_inside_a_json_string(self):
        payload = json.loads(json.dumps(VALID_RESPONSE))
        payload["steps"][1]["bubbles"][1]["text"] = "「你好」"
        lesson = parse_lesson_response(json.dumps(payload, ensure_ascii=False), SCENARIO)
        self.assertEqual(lesson["steps"][1]["bubbles"][1]["text"], "「你好」")

    def test_raises_when_a_required_field_is_missing(self):
        broken = dict(VALID_RESPONSE)
        del broken["subtitle"]
        with self.assertRaises(ValueError):
            parse_lesson_response(json.dumps(broken), SCENARIO)

    def test_raises_when_step_count_is_wrong(self):
        broken = dict(VALID_RESPONSE)
        broken["steps"] = VALID_RESPONSE["steps"][:2]
        with self.assertRaises(ValueError):
            parse_lesson_response(json.dumps(broken), SCENARIO)

    def test_raises_when_step_kinds_are_out_of_order(self):
        broken = dict(VALID_RESPONSE)
        broken["steps"] = [VALID_RESPONSE["steps"][1], VALID_RESPONSE["steps"][0], VALID_RESPONSE["steps"][2]]
        with self.assertRaises(ValueError):
            parse_lesson_response(json.dumps(broken), SCENARIO)

    def test_raises_when_quiz_has_zero_correct_options(self):
        broken = json.loads(json.dumps(VALID_RESPONSE))
        broken["steps"][2]["options"] = [{"text": "A", "correct": False}, {"text": "B", "correct": False}]
        with self.assertRaises(ValueError):
            parse_lesson_response(json.dumps(broken), SCENARIO)

    def test_raises_when_quiz_has_two_correct_options(self):
        broken = json.loads(json.dumps(VALID_RESPONSE))
        broken["steps"][2]["options"] = [{"text": "A", "correct": True}, {"text": "B", "correct": True}]
        with self.assertRaises(ValueError):
            parse_lesson_response(json.dumps(broken), SCENARIO)


if __name__ == "__main__":
    unittest.main()
