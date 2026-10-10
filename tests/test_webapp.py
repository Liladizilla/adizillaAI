import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import webapp


class WebChatTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(webapp.app)

    def test_health_does_not_expose_key(self):
        with patch.dict(os.environ, {"AI_API_KEY": "private-test-key", "AI_PROVIDER": "groq"}, clear=True):
            response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["provider_configured"])
        self.assertNotIn("private-test-key", response.text)

    def test_chat_requires_server_key(self):
        with patch.dict(os.environ, {}, clear=True):
            response = self.client.post("/api/chat", json={"messages": [{"role": "user", "content": "Hello"}]})
        self.assertEqual(response.status_code, 503)
        self.assertIn("AI_API_KEY", response.json()["detail"])

    def test_rejects_empty_message(self):
        response = self.client.post("/api/chat", json={"messages": [{"role": "user", "content": ""}]})
        self.assertEqual(response.status_code, 422)

    def test_rejects_too_many_messages(self):
        messages = [{"role": "user", "content": "hi"}] * 41
        response = self.client.post("/api/chat", json={"messages": messages})
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
