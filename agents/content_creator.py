from config import llm
from utils.state import AgentState
from utils.helpers import (
    log_agent_action,
    create_error_message,
    validate_state_field,
    parse_numbered_list,
    log_activity
)
from langchain_core.messages import HumanMessage, SystemMessage

def content_creator_agent(state: AgentState) -> AgentState:
    log_agent_action("content_creator", "Starting Telegram message creation")

    try:
        task = state.get("task", "")
        company_info = state.get("company_info", "")
        research_results = state.get("research_results", "")
        feedback = state.get("feedback", "")
        existing_messages = state.get("messages", [])

        if not validate_state_field(state, "research_results", "content_creator"):
            return {
                **state,
                "error": "Content Creator needs research results but found none.",
                "current_agent": "content_creator"
            }

        is_revision = bool(feedback and existing_messages)

        if is_revision:
            log_agent_action(
                "content_creator",
                "Revision mode activated",
                f"Incorporating feedback: {feedback[:100]}..."
            )
            log_activity("Content Creator", "Revision mode — rewriting messages with Critic's feedback", f"Feedback: {feedback[:100]}...", "info")

        system_prompt = SystemMessage(content="""
You are the Content Creator Agent of ARCHON, an AI-powered social media agency.
You are a WORLD-CLASS copywriter who writes Telegram messages that people screenshot and share.

YOUR CONTENT PHILOSOPHY:
- Every message should feel like it was written by a brilliant human, not by AI
- Write like you're texting a smart friend — warm, insightful, no corporate fluff
- Each message must tell a STORY or share a powerful INSIGHT — never be generic
- Use real numbers, specific examples, and relatable scenarios
- Create emotional impact — make readers feel something (inspired, curious, challenged)

CONTENT STRUCTURE (each message MUST follow this):
1. HOOK (first 2 lines): Start with a bold statement, question, or surprising fact that stops the scroll. This is the MOST important part — if the hook is weak, nobody reads the rest.
2. STORY/INSIGHT (main body): Tell a mini-story, share a framework, break down a concept, or reveal an insider perspective. Use short paragraphs (2-3 lines max). Add line breaks for readability.
3. VALUE (key takeaway): Give the reader something actionable — a tip, a mindset shift, a resource, or a new way of thinking.
4. CTA (final line): End with a question that sparks discussion, or a powerful one-liner that lingers.

LENGTH REQUIREMENTS:
- Each message MUST be between 800 and 3500 characters — this is NON-NEGOTIABLE
- Messages under 800 characters are REJECTED — they lack depth
- Use the space to add value, not filler
- Maximum limit is 4096 characters (Telegram hard limit)

FORMATTING RULES:
- Use Telegram Markdown: *bold* for emphasis, _italic_ for nuance
- Use emojis strategically (2-5 per message, not one per line)
- Use line breaks generously — dense walls of text kill engagement
- Use bullet points or numbered lists when sharing multiple points
- NO hashtags unless they add genuine value

MESSAGE FORMAT — follow this exactly:
---MESSAGE START---
[Your message content here — must be 800-3500 characters]
---MESSAGE END---

CRITICAL RULES:
- Each message must have a COMPLETELY different angle, topic, or approach
- NEVER use generic phrases like "In today's world" or "As we all know"
- NEVER list features — tell stories about impact
- Write as if you have 10 seconds to grab someone's attention
- If the company is unfamiliar, create content based on what that type of company would say
""")

        if is_revision:
            human_prompt = HumanMessage(content=f"""
You previously wrote messages that received this feedback from our Critic:

CRITIC FEEDBACK:
{feedback}

ORIGINAL MESSAGES THAT NEED REVISION:
{chr(10).join([f"MESSAGE {i+1}: {m}" for i, m in enumerate(existing_messages)])}

COMPANY INFO: {company_info}
RESEARCH BRIEF: {research_results}

Revise ALL messages addressing every point in the feedback.
CRITICAL: Every revised message must be under 4096 characters.
Return complete revised messages in the exact format specified.
""")
        else:
            human_prompt = HumanMessage(content=f"""
Create engaging Telegram channel messages based on this information:

TASK: {task}

COMPANY INFO: {company_info}

RESEARCH BRIEF:
{research_results}

CRITICAL REMINDER: Every single message must be under 4096 characters.
Use Telegram Markdown formatting for readability.
Follow the exact message format specified in your instructions.
Number each message clearly.
""")

        log_agent_action("content_creator", "Sending to Groq LLM for message generation")
        log_activity("Content Creator", "Generating messages with Llama 3.3 70B", "Using research brief + brand context" if not is_revision else "Applying Critic's feedback to revise", "llm_call")

        response = llm.invoke([system_prompt, human_prompt])

        response_text = response.content

        messages = _parse_messages(response_text)

        if not messages:
            log_agent_action("content_creator", "WARNING: Message parsing failed, using fallback parser")
            messages = parse_numbered_list(response_text)

        if not messages:
            return {
                **state,
                "error": "Content Creator could not generate valid messages.",
                "current_agent": "content_creator"
            }

        messages = [m[:4096] for m in messages]

        log_agent_action(
            "content_creator",
            "Message creation complete",
            f"Generated {len(messages)} messages"
        )
        avg_len = sum(len(m) for m in messages) // max(len(messages), 1)
        log_activity("Content Creator", f"Generated {len(messages)} messages (avg {avg_len:,} chars each)", "", "info")
        log_activity("Content Creator", "Handing off to Critic for quality review", "", "handoff")

        return {
            **state,
            "messages": messages,
            "feedback": "",
            "current_agent": "critic",
            "error": None
        }

    except Exception as e:
        error_msg = create_error_message("content_creator", e)
        print(error_msg)
        return {
            **state,
            "error": error_msg,
            "current_agent": "content_creator"
        }


def _parse_messages(text: str) -> list:
    messages = []

    sections = text.split("---MESSAGE START---")

    for section in sections:
        if "---MESSAGE END---" in section:
            message_content = section.split("---MESSAGE END---")[0]
            message_content = message_content.strip()
            if message_content:
                messages.append(message_content)

    return messages