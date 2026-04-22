from langgraph.graph import StateGraph, END
from utils.state import AgentState
from utils.helpers import log_agent_action
from agents.manager import manager_agent
from agents.researcher import researcher_agent
from agents.content_creator import content_creator_agent
from agents.critic import critic_agent
from agents.scheduler import scheduler_agent
from agents.poster import poster_agent

def route_agent(state: AgentState) -> str:
    current = state.get("current_agent", "")
    error = state.get("error", None)

    if error:
        print(f"\n❌ ARCHON PIPELINE ERROR: {error}")
        return END

    if current == "researcher":
        return "researcher"
    elif current == "content_creator":
        return "content_creator"
    elif current == "critic":
        return "critic"
    elif current == "scheduler":
        return "scheduler"
    elif current == "poster":
        return "poster"
    elif current == "done":
        return END
    else:
        print(f"⚠️  Unknown agent: {current}")
        return END

def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("manager", manager_agent)
    graph.add_node("researcher", researcher_agent)
    graph.add_node("content_creator", content_creator_agent)
    graph.add_node("critic", critic_agent)
    graph.add_node("scheduler", scheduler_agent)
    graph.add_node("poster", poster_agent)

    graph.set_entry_point("manager")

    graph.add_conditional_edges("manager", route_agent)
    graph.add_conditional_edges("researcher", route_agent)
    graph.add_conditional_edges("content_creator", route_agent)
    graph.add_conditional_edges("critic", route_agent)
    graph.add_conditional_edges("scheduler", route_agent)
    graph.add_conditional_edges("poster", route_agent)

    return graph.compile()

def run_archon(task: str) -> None:
    print("\n" + "="*60)
    print("🤖 ARCHON DIGITAL AGENCY — STARTING PIPELINE")
    print("="*60)
    print(f"📋 TASK: {task}")
    print("="*60 + "\n")

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

    app = build_graph()

    final_state = app.invoke(initial_state)

    print("\n" + "="*60)
    print("🎉 ARCHON PIPELINE COMPLETE!")
    print("="*60)

    if final_state.get("error"):
        print(f"❌ Pipeline ended with error: {final_state['error']}")
    else:
        posted = final_state.get("posted_message_ids", [])
        messages = final_state.get("messages", [])

        print(f"\n✅ Messages generated: {len(messages)}")
        print(f"✅ Messages posted to Telegram: {len(posted)}")

        if messages:
            print("\n📝 GENERATED MESSAGES:")
            for i, msg in enumerate(messages):
                print(f"\nMESSAGE {i+1}:")
                print(f"{msg}")
                print(f"Characters: {len(msg)}/4096")

        if posted:
            print(f"\n📬 POSTED TELEGRAM MESSAGE IDs:")
            for msg_id in posted:
                print(f"  Message ID: {msg_id}")

    print("\n" + "="*60 + "\n")

if __name__ == "__main__":
    print("\n" + "="*60)
    print("Welcome to ARCHON — Your AI Digital Agency")
    print("="*60)

    print("\nExample tasks:")
    print("  - Create 3 messages about our AI startup that helps small businesses")
    print("  - Write 5 messages for a fitness brand targeting young professionals")
    print("  - Generate 3 messages for a coffee shop in New York\n")

    task = input("📋 Enter your task: ").strip()

    if not task:
        print("❌ No task provided. Please enter a task.")
    else:
        run_archon(task)