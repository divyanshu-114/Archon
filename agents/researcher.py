from config import llm
from utils.state import AgentState
from utils.helpers import log_agent_action, create_error_message, validate_state_field, log_activity
from langchain_core.messages import HumanMessage, SystemMessage
from googlesearch import search

def wrapped_search(query: str) -> str:
    try:
        # Fetch top 3 results with descriptions
        results = search(query, num_results=3, advanced=True)
        return "\n".join([f"- {r.title}: {r.description}" for r in results])
    except Exception as e:
        return f"Error performing search: {e}"

def researcher_agent(state: AgentState) -> AgentState:
    log_agent_action("researcher", "Starting research phase")

    try:
        task = state.get("task", "")
        company_info = state.get("company_info", "")

        if not validate_state_field(state, "task", "researcher"):
            return {
                **state,
                "error": "Researcher received empty task.",
                "current_agent": "researcher"
            }

        system_prompt = SystemMessage(content="""
You are the Research Agent of ARCHON, an AI-powered digital marketing agency.
Your job is to analyze the task and company information, then create a 
comprehensive research brief for the Content Creator.

Your research brief must include:
1. KEY THEMES: Main topics and angles for the posts
2. TRENDING TOPICS: Relevant trends and keywords for Telegram audience engagement
3. CONTENT ANGLES: Specific ideas and hooks for each post
4. TONE GUIDANCE: How the brand should sound based on their info
5. AUDIENCE INSIGHTS: Who we are talking to and what they care about

Be specific, practical, and actionable. The Content Creator will use 
everything you write to generate the actual Telegram channel messages.
""")

        human_prompt = HumanMessage(content=f"""
Research and create a content brief based on this information:

TASK: {task}

COMPANY INFO: {company_info}

SEARCH RESULTS: {_search_for_context(task, company_info)}

Create a detailed research brief following the format in your instructions.
""")

        log_agent_action("researcher", "Analyzing research and building brief")
        log_activity("Researcher", "Building research brief with Llama 3.3 70B", "Combining search results + task context", "llm_call")

        response = llm.invoke([system_prompt, human_prompt])

        research_results = response.content

        log_agent_action("researcher", "Research complete", f"Brief length: {len(research_results)} characters")
        log_activity("Researcher", f"Research brief complete ({len(research_results)} chars)", "", "info")
        log_activity("Researcher", "Handing off to Content Creator", "", "handoff")

        return {
            **state,
            "research_results": research_results,
            "current_agent": "content_creator",
            "error": None
        }

    except Exception as e:
        error_msg = create_error_message("researcher", e)
        print(error_msg)
        return {
            **state,
            "error": error_msg,
            "current_agent": "researcher"
        }


def _search_for_context(task: str, company_info: str) -> str:
    log_agent_action("researcher", "Searching the web for context")

    search_results = ""

    try:
        query1 = f"Telegram channel marketing trends {company_info[:50]}"
        log_activity("Researcher", f'Searching Google: "{query1}"', "", "web_search")
        result1 = wrapped_search(query1)
        search_results += f"SEARCH 1 - Industry Trends:\n{result1}\n\n"
        log_activity("Researcher", "Search 1 complete — industry trends found", "", "web_search")
    except Exception as e:
        search_results += f"SEARCH 1 failed: {str(e)}\n\n"

    try:
        query2 = f"best Telegram content strategies {task[:50]}"
        log_activity("Researcher", f'Searching Google: "{query2}"', "", "web_search")
        result2 = wrapped_search(query2)
        search_results += f"SEARCH 2 - Content Strategies:\n{result2}\n\n"
        log_activity("Researcher", "Search 2 complete — content strategies found", "", "web_search")
    except Exception as e:
        search_results += f"SEARCH 2 failed: {str(e)}\n\n"

    try:
        query3 = f"Telegram channel engagement tips {company_info[:30]} 2024"
        log_activity("Researcher", f'Searching Google: "{query3}"', "", "web_search")
        result3 = wrapped_search(query3)
        search_results += f"SEARCH 3 - Engagement Tips:\n{result3}\n\n"
        log_activity("Researcher", "Search 3 complete — engagement tips found", "", "web_search")
    except Exception as e:
        search_results += f"SEARCH 3 failed: {str(e)}\n\n"

    return search_results if search_results else "No search results available."
    