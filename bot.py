import os
import asyncio
import threading
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
)
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END
from utils.state import AgentState
from utils.helpers import log_agent_action
from agents.manager import manager_agent
from agents.researcher import researcher_agent
from agents.content_creator import content_creator_agent
from agents.critic import critic_agent
from agents.scheduler import scheduler_agent
from config import send_telegram_message, TELEGRAM_CHAT_ID

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# store pending messages per user for approval flow
pending_messages = {}


# ─── Pipeline (without poster — we post after approval) ───

def build_pipeline_graph():
    """Build LangGraph without the poster node — we handle posting after human approval."""
    graph = StateGraph(AgentState)

    graph.add_node("manager", manager_agent)
    graph.add_node("researcher", researcher_agent)
    graph.add_node("content_creator", content_creator_agent)
    graph.add_node("critic", critic_agent)
    graph.add_node("scheduler", scheduler_agent)

    graph.set_entry_point("manager")

    def route(state: AgentState) -> str:
        current = state.get("current_agent", "")
        error = state.get("error", None)

        if error:
            return END
        if current == "researcher":
            return "researcher"
        elif current == "content_creator":
            return "content_creator"
        elif current == "critic":
            return "critic"
        elif current == "scheduler":
            return "scheduler"
        elif current in ("poster", "done"):
            return END
        else:
            return END

    graph.add_conditional_edges("manager", route)
    graph.add_conditional_edges("researcher", route)
    graph.add_conditional_edges("content_creator", route)
    graph.add_conditional_edges("critic", route)
    graph.add_conditional_edges("scheduler", route)

    return graph.compile()


def run_pipeline(task: str) -> dict:
    """Run the ARCHON content pipeline (everything except posting)."""
    initial_state: AgentState = {
        "task": task,
        "company_info": "",
        "research_results": "",
        "messages": [],
        "feedback": "",
        "approved": False,
        "scheduled_times": [],
        "posted_message_ids": [],
        "current_agent": "manager",
        "error": None,
        "revision_count": 0,
    }

    app = build_pipeline_graph()
    final_state = app.invoke(initial_state)
    return final_state


# ─── Bot Command Handlers ───

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    welcome = (
        "🤖 *Welcome to ARCHON — Your AI Digital Agency*\n\n"
        "I generate and post content to your Telegram channel using AI agents.\n\n"
        "🔧 *How to use:*\n"
        "`/generate <your task>`\n\n"
        "📝 *Examples:*\n"
        "• `/generate Create 3 posts about our AI startup`\n"
        "• `/generate Write 2 messages for a fitness brand`\n"
        "• `/generate 3 posts for a coffee shop in Mumbai`\n\n"
        "After generating, I'll show you previews and ask for approval before posting.\n\n"
        "Type `/help` for all commands."
    )
    await update.message.reply_text(welcome, parse_mode="Markdown")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    help_text = (
        "📋 *ARCHON Commands*\n\n"
        "`/start` — Welcome message\n"
        "`/generate <task>` — Generate content with AI agents\n"
        "`/status` — Check bot status\n"
        "`/help` — Show this help\n\n"
        "🔄 *Pipeline Agents:*\n"
        "1️⃣ Manager — analyzes your task\n"
        "2️⃣ Researcher — searches web for insights\n"
        "3️⃣ Content Creator — writes the messages\n"
        "4️⃣ Critic — reviews and improves quality\n"
        "5️⃣ Scheduler — picks optimal posting times\n"
        "6️⃣ You — approve before posting! ✅"
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    has_pending = user_id in pending_messages
    status = (
        "🟢 *ARCHON is online and ready!*\n\n"
        f"📬 Pending approval: {'Yes — use the buttons above to approve/reject' if has_pending else 'None'}\n"
        f"📡 Target channel: `{TELEGRAM_CHAT_ID}`"
    )
    await update.message.reply_text(status, parse_mode="Markdown")


async def generate_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id

    # extract task from command
    if not context.args:
        await update.message.reply_text(
            "❌ Please provide a task!\n\n"
            "*Usage:* `/generate Create 3 posts about our AI startup`",
            parse_mode="Markdown",
        )
        return

    task = " ".join(context.args)

    # progress: starting
    progress_msg = await update.message.reply_text(
        "⏳ *ARCHON Pipeline Starting...*\n\n"
        "🔄 Manager — analyzing task...",
        parse_mode="Markdown",
    )

    # run pipeline in thread to avoid blocking
    loop = asyncio.get_event_loop()

    def _run():
        return run_pipeline(task)

    try:
        # update progress
        await progress_msg.edit_text(
            "⏳ *ARCHON Pipeline Running...*\n\n"
            "✅ Manager — task analyzed\n"
            "🔄 Researcher — searching the web...\n"
            "⬜ Content Creator\n"
            "⬜ Critic\n"
            "⬜ Scheduler",
            parse_mode="Markdown",
        )

        final_state = await loop.run_in_executor(None, _run)

        if final_state.get("error"):
            await progress_msg.edit_text(
                f"❌ *Pipeline Error:*\n`{final_state['error']}`",
                parse_mode="Markdown",
            )
            return

        messages = final_state.get("messages", [])
        scheduled_times = final_state.get("scheduled_times", [])

        if not messages:
            await progress_msg.edit_text(
                "❌ Pipeline finished but no messages were generated.",
                parse_mode="Markdown",
            )
            return

        # update progress to complete
        await progress_msg.edit_text(
            "✅ *ARCHON Pipeline Complete!*\n\n"
            "✅ Manager — task analyzed\n"
            "✅ Researcher — research done\n"
            "✅ Content Creator — messages written\n"
            "✅ Critic — quality approved\n"
            "✅ Scheduler — times picked\n\n"
            f"📝 *{len(messages)} messages ready for review* ⬇️",
            parse_mode="Markdown",
        )

        # send each message as a preview
        for i, msg in enumerate(messages):
            preview = (
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"📄 *Message {i + 1} of {len(messages)}*\n"
                f"━━━━━━━━━━━━━━━━━━━━\n\n"
                f"{msg}\n\n"
                f"📏 _{len(msg)} / 4096 characters_"
            )
            await update.message.reply_text(preview, parse_mode="Markdown")

        # store pending messages for this user
        pending_messages[user_id] = {
            "messages": messages,
            "scheduled_times": scheduled_times,
            "task": task,
        }

        # send approval buttons
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("✅ Approve & Post", callback_data="approve"),
                InlineKeyboardButton("❌ Reject", callback_data="reject"),
            ],
            [
                InlineKeyboardButton("🔄 Regenerate", callback_data="regenerate"),
            ],
        ])

        await update.message.reply_text(
            f"👆 *Review the {len(messages)} messages above.*\n\n"
            "What would you like to do?",
            reply_markup=keyboard,
            parse_mode="Markdown",
        )

    except Exception as e:
        await progress_msg.edit_text(
            f"❌ *Unexpected error:*\n`{str(e)}`",
            parse_mode="Markdown",
        )


# ─── Callback Handlers (Button Clicks) ───

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    user_id = query.from_user.id
    action = query.data

    if action == "approve":
        await _handle_approve(query, user_id)
    elif action == "reject":
        await _handle_reject(query, user_id)
    elif action == "regenerate":
        await _handle_regenerate(query, user_id, context)


async def _handle_approve(query, user_id):
    if user_id not in pending_messages:
        await query.edit_message_text("⚠️ No pending messages found. Generate new ones with /generate")
        return

    data = pending_messages[user_id]
    messages = data["messages"]

    await query.edit_message_text(
        f"🚀 *Posting {len(messages)} messages to Telegram channel...*",
        parse_mode="Markdown",
    )

    posted_ids = []
    for i, msg in enumerate(messages):
        # clean any leftover delimiters
        clean_msg = msg.replace("---MESSAGE START---", "").replace("---MESSAGE END---", "").strip()
        if len(clean_msg) > 4096:
            clean_msg = clean_msg[:4093] + "..."

        result = send_telegram_message(clean_msg)

        if result.get("ok"):
            msg_id = result["result"]["message_id"]
            posted_ids.append(str(msg_id))
        else:
            error = result.get("description", "Unknown error")
            await query.message.reply_text(
                f"⚠️ Message {i + 1} failed: `{error}`",
                parse_mode="Markdown",
            )

        if i < len(messages) - 1:
            await asyncio.sleep(2)

    # cleanup
    del pending_messages[user_id]

    if posted_ids:
        ids_text = "\n".join([f"  • Message ID: `{mid}`" for mid in posted_ids])
        await query.message.reply_text(
            f"🎉 *Successfully posted {len(posted_ids)} of {len(messages)} messages!*\n\n"
            f"{ids_text}\n\n"
            f"📡 Check your channel to see them live!",
            parse_mode="Markdown",
        )
    else:
        await query.message.reply_text("❌ All messages failed to post.")


async def _handle_reject(query, user_id):
    if user_id in pending_messages:
        del pending_messages[user_id]

    await query.edit_message_text(
        "🗑️ *Messages rejected and discarded.*\n\n"
        "Use `/generate <task>` to create new ones.",
        parse_mode="Markdown",
    )


async def _handle_regenerate(query, user_id, context):
    if user_id not in pending_messages:
        await query.edit_message_text("⚠️ No pending task found. Use /generate to start fresh.")
        return

    task = pending_messages[user_id]["task"]
    del pending_messages[user_id]

    await query.edit_message_text(
        "🔄 *Regenerating content with the same task...*\n\n"
        "Running the ARCHON pipeline again...",
        parse_mode="Markdown",
    )

    loop = asyncio.get_event_loop()
    final_state = await loop.run_in_executor(None, lambda: run_pipeline(task))

    if final_state.get("error"):
        await query.message.reply_text(
            f"❌ *Pipeline Error:*\n`{final_state['error']}`",
            parse_mode="Markdown",
        )
        return

    messages = final_state.get("messages", [])
    scheduled_times = final_state.get("scheduled_times", [])

    if not messages:
        await query.message.reply_text("❌ Regeneration produced no messages.")
        return

    # show new previews
    for i, msg in enumerate(messages):
        preview = (
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"📄 *Message {i + 1} of {len(messages)}* (Regenerated)\n"
            f"━━━━━━━━━━━━━━━━━━━━\n\n"
            f"{msg}\n\n"
            f"📏 _{len(msg)} / 4096 characters_"
        )
        await query.message.reply_text(preview, parse_mode="Markdown")

    # store new pending
    pending_messages[user_id] = {
        "messages": messages,
        "scheduled_times": scheduled_times,
        "task": task,
    }

    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Approve & Post", callback_data="approve"),
            InlineKeyboardButton("❌ Reject", callback_data="reject"),
        ],
        [
            InlineKeyboardButton("🔄 Regenerate", callback_data="regenerate"),
        ],
    ])

    await query.message.reply_text(
        f"👆 *Review the {len(messages)} regenerated messages above.*\n\n"
        "What would you like to do?",
        reply_markup=keyboard,
        parse_mode="Markdown",
    )


# ─── Main ───

def main():
    print("\n" + "=" * 60)
    print("🤖 ARCHON Telegram Bot — Starting...")
    print("=" * 60)
    print(f"📡 Target channel: {TELEGRAM_CHAT_ID}")
    print("Send /start to the bot in Telegram to begin!")
    print("=" * 60 + "\n")

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # command handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("generate", generate_command))

    # button callback handler
    app.add_handler(CallbackQueryHandler(button_callback))

    # start polling
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
