# AdizillaAI

AdizillaAI is an AI chat workspace with a responsive chat UI, locally saved conversations, explicit user-controlled memory, and a provider-configurable Python API. The current version is a **local-first starter**, not a launched subscription service.

## Run the web app

1. Install Python 3.11+.
2. Copy `.env.example` to `.env`.
3. Create a free API key with [Groq](https://console.groq.com/) and set `AI_API_KEY` in `.env`. The default endpoint/model use Groq's OpenAI-compatible API. Free tiers have provider-enforced quotas and may change.
4. Install dependencies and start the app:

```bash
python -m pip install -r requirements.txt
uvicorn webapp:app --reload
```

Open `http://127.0.0.1:8000`.

### Alternative providers

The backend uses the OpenAI-compatible chat-completions format. Change these server-side environment variables to switch providers:

- `AI_PROVIDER`: display/status label only.
- `AI_API_KEY`: secret API key; never put it in browser code or commit it.
- `AI_BASE_URL`: provider's OpenAI-compatible base URL.
- `AI_MODEL`: model ID available to that provider.

For [OpenRouter](https://openrouter.ai/), set `AI_BASE_URL=https://openrouter.ai/api/v1` and choose a currently available free model ID from [its free-model list](https://openrouter.ai/collections/free-models/). Free model availability and quotas can change, so don't hardcode a provider model forever.

The old command-line chat remains available with `python main.py "Explain HTTP"`; it uses `OPENAI_API_KEY` and `OPENAI_MODEL`.

## Included in this starter

- Responsive dark-first chat workspace with light theme toggle.
- New conversations, recent history, search, delete, export, and copy response.
- Explicit opt-in memory text that can be edited, disabled, or cleared.
- Browser-local storage for conversations and memory; no account sync yet.
- Server-side API keys and a configurable OpenAI-compatible provider endpoint.
- Clear handling for missing keys, rate limits, and provider errors.
- Free/Pro plan preview that clearly labels billing as not yet active.

## Important limitations before public launch

- Browser-local history is tied to one browser/device and is not a cloud backup. Don't store secrets or sensitive data in memory.
- The current plan selector is a UI preview only. There is no real sign-up, billing, paid access, or server-enforced subscription quota yet. Client-side locks are not security.
- Before accepting paying users, add authentication, a database with per-user access control, server-side usage metering and rate limits, payment webhooks, subscription entitlement checks, abuse protection, and a privacy/retention policy. Never expose a shared provider key to browsers.
- This starter sends recent chat messages to the configured AI provider. Review that provider's terms and data handling before using real user data.
- Attachments, web search, synced memory, and advanced research are roadmap items, not implemented features.

## Tests

```bash
python -m unittest discover -s tests -v
```

Never commit `.env` or real API keys.
