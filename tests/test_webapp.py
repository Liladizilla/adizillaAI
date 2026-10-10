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

    def test_chat_requires_authentication(self):
        with patch.dict(os.environ, {}, clear=True):
            response = self.client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "Hello"}]},
            )
        self.assertEqual(response.status_code, 401)
        self.assertIn("Sign in", response.json()["detail"])

    def test_chat_requires_auth_even_when_provider_key_exists(self):
        with patch.dict(os.environ, {"AI_API_KEY": "private-test-key"}, clear=True):
            response = self.client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "Hello"}]},
            )
        self.assertEqual(response.status_code, 401)

    def test_auth_config_does_not_expose_admin_secret(self):
        secret = '{"type":"service_account","private_key":"do-not-leak"}'
        with patch.dict(os.environ, {
            "FIREBASE_API_KEY": "public-web-key",
            "FIREBASE_AUTH_DOMAIN": "example.firebaseapp.com",
            "FIREBASE_PROJECT_ID": "example-project",
            "FIREBASE_APP_ID": "1:123:web:abc",
            "FIREBASE_SERVICE_ACCOUNT_JSON": secret,
        }, clear=True):
            response = self.client.get("/api/auth/config")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["configured"])
        self.assertNotIn("do-not-leak", response.text)
        self.assertNotIn("FIREBASE_SERVICE_ACCOUNT_JSON", response.text)

    def test_auth_config_is_unconfigured_without_required_web_values(self):
        with patch.dict(os.environ, {}, clear=True):
            response = self.client.get("/api/auth/config")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["configured"])
        self.assertIsNone(response.json()["firebase"])

    def test_rejects_empty_message(self):
        response = self.client.post("/api/chat", json={"messages": [{"role": "user", "content": ""}]})
        self.assertEqual(response.status_code, 422)

    def test_rejects_too_many_messages(self):
        messages = [{"role": "user", "content": "hi"}] * 41
        response = self.client.post("/api/chat", json={"messages": messages})
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
