import time
from config import send_telegram_message
from utils.state import AgentState
from utils.helpers import log_agent_action, create_error_message

def poster_agent(state: AgentState) -> AgentState:
    log_agent_action("poster", "Starting Telegram posting phase")

    try:
        messages = state.get("messages", [])
        scheduled_times = state.get("scheduled_times", [])

        if not messages:
            return {
                **state,
                "error": "Poster received no messages to post.",
                "current_agent": "poster"
            }

        successfully_posted = []

        for i, message_content in enumerate(messages):
            log_agent_action(
                "poster",
                f"Posting message {i + 1} of {len(messages)}",
                f"Preview: {message_content[:50]}..."
            )

            result = _post_single_message(message_content, i)

            if result["success"]:
                successfully_posted.append(result["message_id"])
                log_agent_action(
                    "poster",
                    f"Message {i + 1} posted successfully! 🎉",
                    f"Message ID: {result['message_id']}"
                )
            else:
                log_agent_action(
                    "poster",
                    f"Message {i + 1} failed",
                    result["error"]
                )

            if i < len(messages) - 1:
                log_agent_action("poster", "Waiting 3 seconds before next message...")
                time.sleep(3)

        log_agent_action(
            "poster",
            "Posting phase complete",
            f"Successfully posted: {len(successfully_posted)} of {len(messages)} messages"
        )

        return {
            **state,
            "posted_message_ids": successfully_posted,
            "current_agent": "done",
            "error": None
        }

    except Exception as e:
        error_msg = create_error_message("poster", e)
        print(error_msg)
        return {
            **state,
            "error": error_msg,
            "current_agent": "poster"
        }


def _post_single_message(message_content: str, message_index: int) -> dict:
    try:
        clean_msg = _clean_message(message_content)

        response = send_telegram_message(clean_msg)

        if response.get("ok"):
            message_id = str(response["result"]["message_id"])
            return {
                "success": True,
                "message_id": message_id,
                "error": None
            }
        else:
            error_desc = response.get("description", "Unknown Telegram API error")
            return {
                "success": False,
                "message_id": None,
                "error": f"Telegram API error: {error_desc}"
            }

    except Exception as e:
        return {
            "success": False,
            "message_id": None,
            "error": str(e)
        }


def _clean_message(message_content: str) -> str:
    message = message_content.strip()

    lines_to_remove = [
        "---MESSAGE START---",
        "---MESSAGE END---",
        "MESSAGE START",
        "MESSAGE END"
    ]

    for line in lines_to_remove:
        message = message.replace(line, "")

    message = message.strip()

    if len(message) > 4096:
        message = message[:4093] + "..."

    return message