import os
import json
import uuid
import threading
from datetime import datetime
from flask import Flask, render_template, jsonify, request, redirect
from flask_cors import CORS
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END
from utils.state import AgentState
from agents.manager import manager_agent
from agents.researcher import researcher_agent
from agents.content_creator import content_creator_agent
from agents.critic import critic_agent
from agents.scheduler import scheduler_agent
from config import send_telegram_message, TELEGRAM_CHAT_ID
from utils.helpers import log_activity, set_current_run_id, get_activity_logs

load_dotenv()

app = Flask(__name__)
CORS(app)

# in-memory storage
pipeline_runs = {}
post_history = []

HISTORY_FILE = "post_history.json"


def load_history():
    global post_history
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as f:
            post_history = json.load(f)


def save_history():
    with open(HISTORY_FILE, "w") as f:
        json.dump(post_history, f, indent=2)


load_history()


# ─── Custom pipeline with progress tracking ───

def build_tracked_pipeline(run_id: str):
    """Build pipeline that updates progress in pipeline_runs."""
    graph = StateGraph(AgentState)

    def tracked_agent(agent_func, agent_name):
        def wrapper(state):
            pipeline_runs[run_id]["stages"][agent_name] = "running"
            pipeline_runs[run_id]["current_stage"] = agent_name
            result = agent_func(state)
            if not result.get("error"):
                pipeline_runs[run_id]["stages"][agent_name] = "done"
            else:
                pipeline_runs[run_id]["stages"][agent_name] = "error"
            return result
        return wrapper

    graph.add_node("manager", tracked_agent(manager_agent, "manager"))
    graph.add_node("researcher", tracked_agent(researcher_agent, "researcher"))
    graph.add_node("content_creator", tracked_agent(content_creator_agent, "content_creator"))
    graph.add_node("critic", tracked_agent(critic_agent, "critic"))
    graph.add_node("scheduler", tracked_agent(scheduler_agent, "scheduler"))

    graph.set_entry_point("manager")

    def route(state):
        current = state.get("current_agent", "")
        error = state.get("error", None)
        if error:
            return END
        if current in ("researcher", "content_creator", "critic", "scheduler"):
            return current
        return END

    graph.add_conditional_edges("manager", route)
    graph.add_conditional_edges("researcher", route)
    graph.add_conditional_edges("content_creator", route)
    graph.add_conditional_edges("critic", route)
    graph.add_conditional_edges("scheduler", route)

    return graph.compile()


def run_pipeline_async(run_id: str, task: str):
    """Run pipeline in background thread."""
    set_current_run_id(run_id)
    try:
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

        pipeline = build_tracked_pipeline(run_id)
        final_state = pipeline.invoke(initial_state)

        if final_state.get("error"):
            pipeline_runs[run_id]["status"] = "error"
            pipeline_runs[run_id]["error"] = final_state["error"]
        else:
            pipeline_runs[run_id]["status"] = "awaiting_approval"
            pipeline_runs[run_id]["messages"] = final_state.get("messages", [])
            pipeline_runs[run_id]["scheduled_times"] = final_state.get("scheduled_times", [])

    except Exception as e:
        pipeline_runs[run_id]["status"] = "error"
        pipeline_runs[run_id]["error"] = str(e)


# ─── Routes ───

@app.route("/")
def landing():
    return redirect("/dashboard")


@app.route("/dashboard")
def dashboard():
    return render_template("index.html")


# Custom rate limiter to avoid Gunicorn thread crashes
rate_limits = {}

def check_rate_limit(ip):
    now = datetime.now()
    if ip not in rate_limits:
        rate_limits[ip] = []
    
    # keep only requests from the last 24 hours (86400 seconds)
    rate_limits[ip] = [t for t in rate_limits[ip] if (now - t).total_seconds() < 86400]
    
    if len(rate_limits[ip]) >= 3:
        return "Rate limit exceeded: 3 per 1 day"
        
    if rate_limits[ip] and (now - rate_limits[ip][-1]).total_seconds() < 60:
        return "Rate limit exceeded: 1 per 1 minute"
        
    rate_limits[ip].append(now)
    return None

@app.route("/api/generate", methods=["POST"])
def api_generate():
    client_ip = request.remote_addr
    limit_error = check_rate_limit(client_ip)
    if limit_error:
        return jsonify({"error": limit_error}), 429

    data = request.json
    task = data.get("task", "").strip()

    if not task:
        return jsonify({"error": "No task provided"}), 400

    run_id = str(uuid.uuid4())[:8]

    pipeline_runs[run_id] = {
        "id": run_id,
        "task": task,
        "status": "running",
        "current_stage": "manager",
        "stages": {
            "manager": "pending",
            "researcher": "pending",
            "content_creator": "pending",
            "critic": "pending",
            "scheduler": "pending",
        },
        "messages": [],
        "scheduled_times": [],
        "error": None,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    thread = threading.Thread(target=run_pipeline_async, args=(run_id, task))
    thread.daemon = True
    thread.start()

    return jsonify({"run_id": run_id, "status": "started"})


@app.route("/api/status/<run_id>")
def api_status(run_id):
    if run_id not in pipeline_runs:
        return jsonify({"error": "Run not found"}), 404
    return jsonify(pipeline_runs[run_id])


@app.route("/api/logs/<run_id>")
def api_logs(run_id):
    after = request.args.get("after", 0, type=int)
    logs = get_activity_logs(run_id, after=after)
    return jsonify({"logs": logs, "total": after + len(logs)})


@app.route("/api/approve/<run_id>", methods=["POST"])
def api_approve(run_id):
    if run_id not in pipeline_runs:
        return jsonify({"error": "Run not found"}), 404

    run = pipeline_runs[run_id]
    if run["status"] != "awaiting_approval":
        return jsonify({"error": "Run is not awaiting approval"}), 400

    messages = run["messages"]
    posted_ids = []
    errors = []

    for i, msg in enumerate(messages):
        clean = msg.replace("---MESSAGE START---", "").replace("---MESSAGE END---", "").strip()
        if len(clean) > 4096:
            clean = clean[:4093] + "..."

        result = send_telegram_message(clean)

        if result.get("ok"):
            msg_id = str(result["result"]["message_id"])
            posted_ids.append(msg_id)
        else:
            errors.append(f"Message {i+1}: {result.get('description', 'Unknown error')}")

    run["status"] = "posted"
    run["posted_ids"] = posted_ids

    # save to history
    history_entry = {
        "run_id": run_id,
        "task": run["task"],
        "messages": messages,
        "posted_ids": posted_ids,
        "posted_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "channel": str(TELEGRAM_CHAT_ID),
    }
    post_history.insert(0, history_entry)
    save_history()

    return jsonify({
        "status": "posted",
        "posted_ids": posted_ids,
        "errors": errors,
        "count": len(posted_ids),
    })


@app.route("/api/reject/<run_id>", methods=["POST"])
def api_reject(run_id):
    if run_id not in pipeline_runs:
        return jsonify({"error": "Run not found"}), 404

    pipeline_runs[run_id]["status"] = "rejected"
    return jsonify({"status": "rejected"})


@app.route("/api/regenerate/<run_id>", methods=["POST"])
def api_regenerate(run_id):
    if run_id not in pipeline_runs:
        return jsonify({"error": "Run not found"}), 404

    run = pipeline_runs[run_id]
    task = run["task"]

    # create new run with same task
    new_run_id = str(uuid.uuid4())[:8]

    pipeline_runs[new_run_id] = {
        "id": new_run_id,
        "task": task,
        "status": "running",
        "current_stage": "manager",
        "stages": {
            "manager": "pending",
            "researcher": "pending",
            "content_creator": "pending",
            "critic": "pending",
            "scheduler": "pending",
        },
        "messages": [],
        "scheduled_times": [],
        "error": None,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    pipeline_runs[run_id]["status"] = "regenerated"

    thread = threading.Thread(target=run_pipeline_async, args=(new_run_id, task))
    thread.daemon = True
    thread.start()

    return jsonify({"new_run_id": new_run_id, "status": "regenerating"})


@app.route("/api/history")
def api_history():
    return jsonify(post_history[:20])


@app.route("/api/history/clear", methods=["POST"])
def api_history_clear():
    global post_history
    post_history = []
    save_history()
    return jsonify({"status": "cleared"})


# ─── Main ───

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("🤖 ARCHON Dashboard — Starting...")
    print("=" * 60)
    print("🌐 Open http://localhost:5000 in your browser")
    print(f"📡 Target Telegram channel: {TELEGRAM_CHAT_ID}")
    print("=" * 60 + "\n")

    app.run(debug=True, port=5000, use_reloader=False)
