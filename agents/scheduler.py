from config import fast_llm
from utils.state import AgentState
from utils.helpers import log_agent_action, create_error_message, log_activity
from langchain_core.messages import HumanMessage, SystemMessage
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import json

scheduler = BackgroundScheduler()
scheduler.start()

def scheduler_agent(state: AgentState) -> AgentState:
    log_agent_action("scheduler", "Starting scheduling phase")

    try:
        messages = state.get("messages", [])
        company_info = state.get("company_info", "")

        if not messages:
            return {
                **state,
                "error": "Scheduler received no messages to schedule.",
                "current_agent": "scheduler"
            }

        num_messages = len(messages)

        system_prompt = SystemMessage(content="""
You are the Scheduler Agent of ARCHON, an AI-powered digital marketing agency.
You are an expert in Telegram channel engagement patterns and optimal posting times.

Your job is to create an intelligent posting schedule.

Rules for scheduling:
1. Space messages at least 4 hours apart minimum
2. Never schedule between 11pm and 7am
3. Best time slots for Telegram: 9am, 12pm, 3pm, 6pm, 8pm
4. Spread messages across multiple days for consistent presence
5. Consider that Telegram users are most active during commute hours and evenings

You must respond with ONLY a valid JSON array in this exact format:
[
    {"post_index": 0, "datetime": "YYYY-MM-DD HH:MM", "reason": "why this time"},
    {"post_index": 1, "datetime": "YYYY-MM-DD HH:MM", "reason": "why this time"}
]

Return ONLY the JSON. No explanation before or after.
""")

        now = datetime.now()
        schedule_start = now + timedelta(hours=1)

        human_prompt = HumanMessage(content=f"""
Create an optimal posting schedule for {num_messages} Telegram messages.

COMPANY INFO: {company_info}

Current datetime: {now.strftime("%Y-%m-%d %H:%M")}
Start scheduling from: {schedule_start.strftime("%Y-%m-%d %H:%M")}

Return the JSON schedule for exactly {num_messages} messages.
""")

        log_agent_action("scheduler", f"Planning schedule for {num_messages} messages")
        log_activity("Scheduler", f"Planning optimal schedule for {num_messages} messages", "", "info")
        log_activity("Scheduler", "Calling Llama 3.1 8B for schedule generation", "", "llm_call")

        response = fast_llm.invoke([system_prompt, human_prompt])

        response_text = response.content.strip()

        schedule = _parse_schedule(response_text)

        if not schedule:
            log_agent_action("scheduler", "LLM schedule parsing failed, using smart fallback")
            schedule = _generate_fallback_schedule(num_messages)

        scheduled_times = []

        for item in schedule:
            post_index = item.get("post_index", 0)
            post_datetime = item.get("datetime", "")
            reason = item.get("reason", "Optimal engagement time")

            if post_index < len(messages):
                scheduled_times.append(post_datetime)
                _schedule_single_post(post_index, post_datetime, messages[post_index])
                log_agent_action(
                    "scheduler",
                    f"Message {post_index + 1} scheduled",
                    f"{post_datetime} — {reason}"
                )

        log_agent_action(
            "scheduler",
            "All messages scheduled successfully",
            f"Total scheduled: {len(scheduled_times)}"
        )
        times_summary = ", ".join(scheduled_times[:5])
        log_activity("Scheduler", f"Scheduled {len(scheduled_times)} messages: {times_summary}", "", "tool_use")
        log_activity("Scheduler", "Pipeline complete — awaiting your approval", "", "info")

        return {
            **state,
            "scheduled_times": scheduled_times,
            "current_agent": "poster",
            "error": None
        }

    except Exception as e:
        error_msg = create_error_message("scheduler", e)
        print(error_msg)
        return {
            **state,
            "error": error_msg,
            "current_agent": "scheduler"
        }


def _parse_schedule(text: str) -> list:
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        schedule = json.loads(text)

        if isinstance(schedule, list):
            return schedule

        return []

    except json.JSONDecodeError as e:
        print(f"⚠️  Schedule JSON parsing failed: {str(e)}")
        return []


def _generate_fallback_schedule(num_messages: int) -> list:
    schedule = []

    best_times = ["09:00", "12:00", "15:00", "18:00", "20:00"]

    base_date = datetime.now() + timedelta(hours=2)

    for i in range(num_messages):
        day_offset = i // len(best_times)
        time_slot = best_times[i % len(best_times)]

        post_date = base_date + timedelta(days=day_offset)
        post_datetime = f"{post_date.strftime('%Y-%m-%d')} {time_slot}"

        schedule.append({
            "post_index": i,
            "datetime": post_datetime,
            "reason": f"Optimal Telegram engagement slot {time_slot}"
        })

    return schedule


def _schedule_single_post(post_index: int, post_datetime: str, post_content: str) -> None:
    try:
        run_time = datetime.strptime(post_datetime, "%Y-%m-%d %H:%M")

        if run_time <= datetime.now():
            run_time = datetime.now() + timedelta(minutes=5)

        scheduler.add_job(
            func=_post_job_placeholder,
            trigger="date",
            run_date=run_time,
            args=[post_index, post_content],
            id=f"post_{post_index}_{post_datetime.replace(' ', '_')}",
            replace_existing=True
        )

    except Exception as e:
        print(f"⚠️  Failed to schedule message {post_index}: {str(e)}")


def _post_job_placeholder(post_index: int, post_content: str) -> None:
    print(f"\n🚀 SCHEDULED JOB TRIGGERED: Message {post_index + 1}")
    print(f"Content preview: {post_content[:100]}...")
    print("Handing off to Poster Agent...")