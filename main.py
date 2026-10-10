"""A minimal, configurable AI chat CLI for the adizillaAI repository."""
import os
import sys

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()


def chat(prompt: str) -> str:
    prompt = prompt.strip()
    if not prompt:
        raise ValueError("Prompt cannot be empty.")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is missing. Add it to .env or the environment.")
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[
            {"role": "system", "content": "You are AdizillaAI, a clear, honest, helpful AI assistant. State uncertainty instead of inventing facts."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
        max_tokens=1200,
    )
    answer = response.choices[0].message.content
    if not answer or not answer.strip():
        raise RuntimeError("The model returned an empty response.")
    return answer.strip()


def main() -> int:
    prompt = " ".join(sys.argv[1:]).strip() if len(sys.argv) > 1 else input("You: ").strip()
    try:
        print("AdizillaAI: " + chat(prompt))
    except (ValueError, RuntimeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"Request failed ({type(exc).__name__}). Check network, API access, and model settings.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
