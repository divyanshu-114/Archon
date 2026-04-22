from config import llm
from utils.state import AgentState
from utils.helpers import (
    log_agent_action,
    create_error_message,
    validate_state_field,
    format_posts_for_review,
    log_activity
)
from langchain_core.messages import HumanMessage, SystemMessage

MAX_REVISION_CYCLES = 2

def critic_agent(state: AgentState) -> AgentState:
    log_agent_action("critic", "Starting message quality review")

    try:
        messages = state.get("messages", [])
        company_info = state.get("company_info", "")
        task = state.get("task", "")
        revision_count = state.get("revision_count", 0)

        if not messages:
            return {
                **state,
                "error": "Critic received no messages to review.",
                "current_agent": "critic"
            }

        if revision_count >= MAX_REVISION_CYCLES:
            log_agent_action(
                "critic",
                "Max revision cycles reached",
                f"Approving after {revision_count} revisions"
            )
            log_activity("Critic", f"Max revision cycles reached ({revision_count}) — auto-approving", "", "decision")
            return {
                **state,
                "approved": True,
                "current_agent": "scheduler",
                "error": None
            }

        formatted_messages = format_posts_for_review(messages)

        system_prompt = SystemMessage(content="""
You are the Critic Agent of ARCHON, an AI-powered social media agency.
You are a RUTHLESSLY high-standards content editor with decades of experience.
You believe most content is mediocre, and your job is to make it exceptional.

YOUR MINDSET:
- You are NOT here to validate — you are here to IMPROVE
- If this is the FIRST review (no prior feedback), you MUST find real problems and request revisions
- NEVER give a passing score on the first review — first drafts always need work
- On the second review (after revision), evaluate fairly if improvements were made
- A score of 8+ means "this could go viral" — don't give it unless you genuinely believe that

REVIEW CRITERIA (score each 1-10, be honest and harsh):
1. HOOK STRENGTH: Would YOU stop scrolling to read this? Be honest. (1-10)
2. DEPTH & VALUE: Does it teach something, share a story, or provide real insight? Generic surface-level content = score of 3. (1-10)
3. EMOTIONAL IMPACT: Does it make you FEEL something? Inspired, curious, challenged? Flat/robotic text = score of 4. (1-10)
4. ORIGINALITY: Is this something you haven't read 100 times before? Cliché = score of 3. (1-10)
5. ENGAGEMENT POTENTIAL: Would you forward this to someone? Would it get reactions? (1-10)
6. LENGTH & FORMATTING: Is each message at least 800 characters? Is Markdown used well? Messages under 800 chars = AUTOMATIC FAIL. (1-10)
7. CHARACTER COUNT: Is every message under 4096 characters? (PASS or FAIL)

SCORING GUIDANCE — be brutally honest:
- 1-3: Bad. Generic, short, or AI-sounding
- 4-5: Below average. Lacks depth, weak hook, forgettable
- 6-7: Decent but not ready. Needs stronger hooks, more depth, or better structure
- 8-9: Strong. Compelling, original, would share it
- 10: Exceptional. Once in a hundred posts

Respond in EXACTLY this format:

OVERALL_SCORE: [average across all criteria, be precise like 5.8 or 6.2]
APPROVED: [YES or NO]
FEEDBACK: [Specific, actionable feedback for EACH message. Tell the Content Creator exactly what to fix, what's weak, and how to improve it. Be direct.]
STRENGTHS: [What was done well — be brief here]

APPROVAL RULES:
- First review: APPROVED must be NO (first drafts always need revision)
- Second review: If OVERALL_SCORE is 8.0 or above AND all messages are 800+ chars AND under 4096 chars, set APPROVED to YES
- If ANY message is under 800 characters, APPROVED must be NO regardless of score
- If ANY message exceeds 4096 characters, APPROVED must be NO
""")

        human_prompt = HumanMessage(content=f"""
Review these Telegram messages for the following brand:

COMPANY INFO: {company_info}

ORIGINAL TASK: {task}

REVIEW NUMBER: {"FIRST REVIEW (must reject and request revision)" if revision_count == 0 else f"REVISION REVIEW #{revision_count} (evaluate improvements fairly)"}

MESSAGES TO REVIEW:
{formatted_messages}

CHARACTER COUNTS PER MESSAGE:
{chr(10).join([f"Message {i+1}: {len(m)} characters {'✅' if 800 <= len(m) <= 4096 else '❌ TOO SHORT' if len(m) < 800 else '❌ TOO LONG'}" for i, m in enumerate(messages)])}

Apply your highest standards. Be specific in your feedback.
""")

        log_agent_action("critic", "Sending messages to Groq LLM for review")
        log_activity("Critic", f"Reviewing {len(messages)} messages on 6 quality criteria", "Hook, clarity, engagement, brand alignment, formatting, character count", "llm_call")

        response = llm.invoke([system_prompt, human_prompt])

        response_text = response.content

        approved, feedback, score = _parse_critic_response(response_text)

        log_agent_action(
            "critic",
            f"Review complete — Score: {score} — Approved: {approved}",
            feedback[:150]
        )

        if approved:
            log_activity("Critic", f"Score: {score}/10 — Content APPROVED ✅", "", "decision")
            log_activity("Critic", "Handing off to Scheduler", "", "handoff")
            return {
                **state,
                "approved": True,
                "feedback": "",
                "current_agent": "scheduler",
                "error": None
            }
        else:
            log_activity("Critic", f"Score: {score}/10 — Needs revision (cycle {revision_count + 1}/{MAX_REVISION_CYCLES})", f"Feedback: {feedback[:120]}...", "decision")
            log_activity("Critic", "Sending back to Content Creator with feedback", "", "handoff")
            return {
                **state,
                "approved": False,
                "feedback": feedback,
                "revision_count": revision_count + 1,
                "current_agent": "content_creator",
                "error": None
            }

    except Exception as e:
        error_msg = create_error_message("critic", e)
        print(error_msg)
        return {
            **state,
            "error": error_msg,
            "current_agent": "critic"
        }


def _parse_critic_response(text: str) -> tuple:
    approved = False
    feedback = ""
    score = "0"

    lines = text.strip().split("\n")
    current_section = None

    for line in lines:
        line = line.strip()

        if line.startswith("OVERALL_SCORE:"):
            score = line.replace("OVERALL_SCORE:", "").strip()

        elif line.startswith("APPROVED:"):
            approval_text = line.replace("APPROVED:", "").strip().upper()
            approved = approval_text == "YES"

        elif line.startswith("FEEDBACK:"):
            current_section = "feedback"
            feedback = line.replace("FEEDBACK:", "").strip()

        elif line.startswith("STRENGTHS:"):
            current_section = "strengths"

        elif current_section == "feedback" and line:
            feedback += " " + line

    return approved, feedback, score