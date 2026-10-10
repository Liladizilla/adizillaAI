# AdizillaAI

**Think beyond.** AdizillaAI is a personal AI workspace built around focused conversations, user-controlled memory, cloud-synced chat history, and file-aware assistance.

- **Live app:** https://adizillaai.vercel.app
- **Source:** https://github.com/Liladizilla/adizillaAI
- **Stack:** Python · FastAPI · vanilla JavaScript · Firebase Authentication · Firestore · Vercel


<p align="center">
  <a href="https://adizillaai.vercel.app"><strong>Open the live app ↗</strong></a>
</p>

## Desktop preview

![AdizillaAI desktop workspace, captured at 1440 × 1000](https://cdn.browser-use.com/screenshots/7776f2f8-547c-467b-a373-d7a6e8a82f14/1.png)

## What it can do

- Responsive dark-first workspace with a light theme, recent conversations, search, export, and response copying.
- Firebase email/password and Google sign-in, password reset, and server-side ID-token verification.
- Firestore-backed conversation history for signed-in accounts. Guest history stays in the current browser.
- User-controlled memory that can be edited, enabled, disabled, or cleared.
- File attachments for supported image formats, PDFs, Word documents, text, data, and code files.
- On-demand image generation through the xAI Imagine API, with an account-level limit of three images per UTC day.
- Server-side per-account chat limits, defaulting to 20 requests per UTC day and 5 per minute.
- A configurable OpenAI-compatible API provider, with credentials kept on the server.
- RevenueCat Web Billing integration for the Pro paywall and the `adizilla_ai_pro` entitlement (requires a configured Web Billing public key, products, and current Offering).

## Run locally

Requirements: Python 3.11 or newer.

1. Clone the repository and enter the project directory.
2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Add an API key for a compatible AI provider to `.env`. The default configuration uses Groq's OpenAI-compatible endpoint. Free model availability and limits can change.
4. Install dependencies and start the server:

   ```bash
   python -m pip install -r requirements.txt
   uvicorn webapp:app --reload
   ```

5. Open http://127.0.0.1:8000.

Never commit `.env`, provider API keys, Firebase service-account JSON, or other secrets.

## Configuration

### AI provider

Set these server-side environment variables:

| Variable | Purpose |
| --- | --- |
| `AI_API_KEY` | Secret API key for the configured provider |
| `AI_PROVIDER` | Provider label used for status and routing |
| `AI_BASE_URL` | OpenAI-compatible API base URL |
| `AI_MODEL` | Model identifier supported by that provider |

For OpenRouter, use `AI_BASE_URL=https://openrouter.ai/api/v1` and choose a currently available model from [OpenRouter's free-model list](https://openrouter.ai/collections/free-models/).

The older command-line chat remains available with `python main.py "Explain HTTP"`; it uses `OPENAI_API_KEY` and `OPENAI_MODEL`.

### Firebase and Firestore

The hosted app requires Firebase Authentication and Firestore.

1. Create a Firebase project and add a Web app.
2. Enable **Email/Password** and **Google** in Authentication. Add `adizillaai.vercel.app` to the authorized domains.
3. Set the public Web SDK values as Vercel environment variables: `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, and `FIREBASE_APP_ID`. Optional values are `FIREBASE_STORAGE_BUCKET` and `FIREBASE_MESSAGING_SENDER_ID`.
4. Create a Firebase Admin service-account key and store its complete JSON only in the server-side Vercel variable `FIREBASE_SERVICE_ACCOUNT_JSON`. Never put it in browser code or GitHub.
5. Create a Firestore database. The backend uses the Admin SDK for the `adizilla_usage` counters and each user's `adizilla_users/{uid}/chats` collection.
6. Redeploy after changing environment variables.

The Firebase Web SDK configuration is public by design. The service-account JSON is highly sensitive. Restrict the Web API key to the APIs this app needs.

### Images and vision

Image creation uses the xAI Imagine API. Configure a valid `IMAGE_API_KEY` in Vercel (or use an existing `GROK_02` key), and optionally set `IMAGE_BASE_URL` and `IMAGE_MODEL`. The default model is `grok-imagine-image-2.0`. Image generation may incur separate provider charges; the app limits each account to three generations per UTC day. Generated image URLs are temporary, so save an image you want to keep.

Image attachments use a separate vision-capable model because the default Groq chat model may not accept image input. Configure a valid xAI key as `VISION_API_KEY` (or use `GROK_02`) and optionally set `VISION_BASE_URL` and `VISION_MODEL`. The default vision model is `grok-4.7`. Text and document attachments continue to use the normal chat provider.

### Usage limits

The server enforces limits through Firestore counters:

- `DAILY_CHAT_LIMIT`: defaults to 20 requests per user per UTC day.
- `MINUTE_CHAT_LIMIT`: defaults to 5 requests per user per minute.

If Firestore is unavailable, chat requests fail closed with HTTP 503 rather than bypassing usage protection. These request caps are basic abuse controls, **not** a fixed-cost guarantee: token-level metering and server-side subscription entitlement enforcement are not implemented.

## Attachments

The composer accepts up to four files per message, with a combined raw payload limit of 3 MB and a 2.5 MB per-file limit. Supported formats include:

- Images: PNG, JPEG, WebP, GIF. Image understanding depends on whether the configured model supports vision.
- Documents: text-based PDF and DOCX files.
- Text and code: TXT, Markdown, CSV/TSV, JSON, XML, and common source/configuration files.

PDFs are processed by extracting text; scanned PDFs without a text layer may not produce useful content. Attachments are sent to the configured AI provider with the request and are not stored as separate cloud files. Avoid uploading secrets or sensitive documents. Vercel's request-size limits also apply.

## Data boundaries and current limitations

- Signed-in conversation history syncs through authenticated API routes. The API derives the storage owner from the verified Firebase ID token, not a user ID supplied by the browser.
- Cloud history is limited to 100 conversations per account and up to 40 recent messages per conversation. Export important chats as a backup.
- Saved memory remains local to the browser and does not sync between devices.
- Client-side RevenueCat checkout is integrated, but server-side paid-access enforcement and subscription lifecycle webhooks still need to be configured before paid features are unlocked.
- Web search, account deletion, long-term synced memory, and token-based cost metering are not implemented.
- Recent chat context and any attachments are sent to the configured AI provider. Review that provider's privacy terms before using real user data.

Before a public paid launch, add billing webhooks and server-side entitlements, token-level usage metering, stronger abuse controls, account deletion/export workflows, backups, and a clear privacy and retention policy.

## Tests

Run the test suite with:

```bash
python -m unittest discover -s tests -v
```

## License

See the repository's [MIT license](LICENSE).
