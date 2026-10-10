# adizillaAI

A minimal AI assistant CLI with a clean foundation for future tools and agents. This repository previously contained only a placeholder README; this initial implementation deliberately starts with a small, testable chat interface rather than pretending orchestration features already exist.

## Setup
1. Install Python 3.11+.
2. Create `.env` from `.env.example` and set your OpenAI API key.
3. Install and run:

```bash
python -m pip install -r requirements.txt
python main.py "Explain how HTTP requests work"
```

Run `python main.py` without arguments to enter a prompt interactively.

Set `OPENAI_MODEL` to use another model available to your account. API usage may incur charges. Never commit `.env` or put API keys in source code.

## Current scope
- Single-turn chat via the OpenAI Python SDK.
- Model selection via environment variable.
- Prompt and configuration validation.
- Offline unit tests and GitHub Actions CI.

Multi-agent orchestration, memory, tools, web access, and autonomous code execution are not implemented yet.
