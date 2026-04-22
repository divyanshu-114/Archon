from datetime import datetime
from typing import Any
import threading

# thread-safe activity log store — keyed by run_id
_activity_logs = {}
_logs_lock = threading.Lock()

# thread-local storage to pass run_id into agents without changing signatures
_thread_context = threading.local()


def set_current_run_id(run_id: str) -> None:
    _thread_context.run_id = run_id


def get_current_run_id() -> str:
    return getattr(_thread_context, "run_id", None)


def log_activity(agent: str, action: str, detail: str = "", log_type: str = "info") -> None:
    """Log an activity entry visible in the live dashboard feed.

    log_type can be: llm_call, web_search, tool_use, decision, handoff, info
    """
    run_id = get_current_run_id()
    timestamp = datetime.now().strftime("%H:%M:%S")

    entry = {
        "timestamp": timestamp,
        "agent": agent,
        "action": action,
        "detail": detail,
        "type": log_type,
    }

    # also print to console
    icon = {
        "llm_call": "🧠",
        "web_search": "🔍",
        "tool_use": "🔧",
        "decision": "⚖️",
        "handoff": "➡️",
        "info": "📋",
    }.get(log_type, "📋")

    print(f"[{timestamp}] {icon} {agent.upper()} → {action}" + (f" | {detail}" if detail else ""))

    if run_id:
        with _logs_lock:
            if run_id not in _activity_logs:
                _activity_logs[run_id] = []
            _activity_logs[run_id].append(entry)


def get_activity_logs(run_id: str, after: int = 0) -> list:
    with _logs_lock:
        logs = _activity_logs.get(run_id, [])
        return logs[after:]


def clear_activity_logs(run_id: str) -> None:
    with _logs_lock:
        _activity_logs.pop(run_id, None)


def log_agent_action(agent_name: str, action: str, detail: str = "") -> None:
    timestamp = datetime.now().strftime("%H:%M:%S")
    separator = "-" * 50
    print(f"\n{separator}")
    print(f"[{timestamp}] 🤖 AGENT: {agent_name.upper()}")
    print(f"[{timestamp}] ⚡ ACTION: {action}")
    if detail:
        print(f"[{timestamp}] 📋 DETAIL: {detail}")
    print(f"{separator}\n")

def format_posts_for_review(posts: list) -> str:
    if not posts:
        return "No posts generated yet."
    
    formatted = ""
    for i, post in enumerate(posts, start=1):
        formatted += f"\n{'='*40}\n"
        formatted += f"POST {i}:\n"
        formatted += f"{post}\n"
    
    formatted += f"\n{'='*40}\n"
    return formatted

def validate_state_field(state: dict, field: str, agent_name: str) -> bool:
    if field not in state or not state[field]:
        print(f"⚠️  WARNING: {agent_name} expected '{field}' in state but it was empty or missing.")
        return False
    return True

def create_error_message(agent_name: str, error: Exception) -> str:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return f"[{timestamp}] ERROR in {agent_name}: {str(error)}"

def parse_numbered_list(text: str) -> list:
    lines = text.strip().split("\n")
    results = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line[0].isdigit() and len(line) > 2:
            if line[1] in [".", ")", ":"]:
                line = line[2:].strip()
        if line:
            results.append(line)
    return results