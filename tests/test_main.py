import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import main


class ChatTests(unittest.TestCase):
    def test_rejects_empty_prompt(self):
        with self.assertRaisesRegex(ValueError, "empty"):
            main.chat(" ")

    def test_missing_key_is_actionable(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "OPENAI_API_KEY"):
                main.chat("hello")

    def test_calls_configured_model_and_returns_answer(self):
        response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="Hello there"))])
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key", "OPENAI_MODEL": "test-model"}, clear=True):
            with patch.object(main, "OpenAI") as client:
                client.return_value.chat.completions.create.return_value = response
                self.assertEqual(main.chat("hello"), "Hello there")
                self.assertEqual(client.return_value.chat.completions.create.call_args.kwargs["model"], "test-model")


if __name__ == "__main__":
    unittest.main()
