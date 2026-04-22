import os
import requests
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found. Please add it to your .env file.")

if not TELEGRAM_BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN not found. Please add it to your .env file.")

if not TELEGRAM_CHAT_ID:
    print("⚠️  WARNING: TELEGRAM_CHAT_ID not found in .env — posting will fail until you set it.")

llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model="llama-3.3-70b-versatile",
    temperature=0.7,
)

fast_llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model="llama-3.1-8b-instant",
    temperature=0.3,
)

TELEGRAM_API_BASE = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"


def send_telegram_message(text: str, parse_mode: str = "Markdown") -> dict:
    url = f"{TELEGRAM_API_BASE}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": parse_mode,
    }
    response = requests.post(url, json=payload)
    result = response.json()

    # if Markdown parsing fails, retry without formatting
    if not result.get("ok") and "can't parse entities" in result.get("description", "").lower():
        print(f"⚠️  Markdown parsing failed, retrying as plain text...")
        payload.pop("parse_mode", None)
        response = requests.post(url, json=payload)
        result = response.json()

    return result