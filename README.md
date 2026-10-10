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
- Firebase ID-token verification plus Firestore-backed per-user chat limits (20 requests/day and 5/minute by default).
- Free/Pro plan preview that clearly labels billing as not yet active.

## Important limitations before public launch

- Browser-local history is tied to one browser/device and is not a cloud backup. Don't store secrets or sensitive data in memory.
- The current plan selector is a UI preview only. There is no billing or paid access. The API enforces a basic per-user request limit through Firestore, but there is no token-based billing meter or subscription entitlement system yet.
- Before accepting paying users, add authentication, a database with per-user access control, server-side usage metering and rate limits, payment webhooks, subscription entitlement checks, abuse protection, and a privacy/retention policy. Never expose a shared provider key to browsers.
- This starter sends recent chat messages to the configured AI provider. Review that provider's terms and data handling before using real user data.
- Attachments, web search, synced memory, and advanced research are roadmap items, not implemented features.

## Tests

```bash
python -m unittest discover -s tests -v
```

Never commit `.env` or real API keys.

## Authentication setup (required for the hosted app)

The web app now uses Firebase Authentication for email/password accounts, Google sign-in, password resets, and sign-out. The FastAPI chat endpoint verifies Firebase ID tokens server-side; a client-side signed-in state alone is not trusted.

1. Create or choose a project in [Firebase Console](https://console.firebase.google.com/), add a **Web app**, and copy its Web SDK configuration.
2. In **Authentication → Sign-in method**, enable **Email/Password** and **Google**. In **Authentication → Settings → Authorized domains**, ensure `adizillaai.vercel.app` is listed.
3. In **Project settings → General**, copy the Web app values into Vercel Production environment variables:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_APP_ID`
   - Optional: `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`
4. In **Project settings → Service accounts**, generate a private key for the Firebase Admin SDK. Store the complete service-account JSON as the Vercel **server-only** environment variable `FIREBASE_SERVICE_ACCOUNT_JSON`. Set `FIREBASE_PROJECT_ID` to the same project ID. Never put the service-account JSON in frontend code, GitHub, or a `VITE_` variable.
5. Open **Build → Firestore Database** in Firebase Console and create a database in production mode. The backend uses the Firebase Admin SDK to write usage counters to the `adizilla_usage` collection; Firestore Security Rules do not grant browser clients access to this collection.
6. Redeploy after saving the environment variables and enabling Firestore. Default server-side limits are 20 chat requests per user per UTC day and 5 per user per minute. Optional Vercel variables `DAILY_CHAT_LIMIT` and `MINUTE_CHAT_LIMIT` can adjust these limits. If Firestore is unavailable, chat requests fail closed with HTTP 503 instead of bypassing the limits.
7. Test email sign-up, sign-in, password reset, Google sign-in, sign-out, rate limits, and a chat request.

The frontend Web SDK configuration is public by design; the Admin service-account JSON is highly sensitive. Restrict the Web API key to the APIs this Firebase app needs.

### Current account boundaries

- Chat API requests require a valid Firebase ID token verified by Firebase Admin.
- Browser-local chats and memory are namespaced by Firebase user ID to keep accounts separate on a shared browser.
- **Cloud-synced chat history, cross-device memory sync, account deletion, token-based cost metering, and billing are not implemented yet.** Authentication creates and verifies identities, but it does not automatically store conversations in the cloud. The current request limits are a basic abuse-control measure, not a guarantee of a fixed monetary spend.
- For production launch, configure Firebase email/password and Google providers, authorized domains, security policies, backups, and abuse/rate limits before inviting a large user base.
