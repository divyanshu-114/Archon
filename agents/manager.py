from config import llm
from utils.state import AgentState
from utils.helpers import log_agent_action, validate_state_field, create_error_message, log_activity
from langchain_core.messages import HumanMessage, SystemMessage

def manager_agent(state: AgentState) -> AgentState:
    log_agent_action("manager", "Starting task analysis", state.get("task", "No task provided"))
    
    try:
        task = state.get("task", "")
        
        if not task:
            return {
                **state,
                "error": "No task provided to manager agent.",
                "current_agent": "manager"
            }
        
        system_prompt = SystemMessage(content="""
You are the Manager Agent of ARCHON, an AI-powered digital marketing agency.
Your job is to:
1. Analyze the user's task carefully
2. Extract all company information mentioned
3. Create a clear content brief for the team

When extracting company info, look for:
- Company name
- What the company does
- Target audience
- Brand tone (professional, fun, casual, etc.)
- Any specific requirements mentioned

Respond in this exact format:
COMPANY_INFO: [extracted company details here]
CONTENT_BRIEF: [what needs to be created, how many posts, any specific themes]
RESEARCH_NEEDED: [what information should be researched to make better content]
""")
        
        human_prompt = HumanMessage(content=f"""
Analyze this task and extract the information:

TASK: {task}

Remember to follow the exact response format specified.
""")
        
        log_agent_action("manager", "Sending task to Groq LLM for analysis")
        log_activity("Manager", "Sending task to Llama 3.3 70B for analysis", f"Task: {task[:80]}...", "llm_call")
        
        response = llm.invoke([system_prompt, human_prompt])
        
        response_text = response.content
        
        company_info = ""
        content_brief = ""
        
        lines = response_text.strip().split("\n")
        
        current_section = None
        
        for line in lines:
            line = line.strip()
            
            if line.startswith("COMPANY_INFO:"):
                current_section = "company"
                company_info = line.replace("COMPANY_INFO:", "").strip()
                
            elif line.startswith("CONTENT_BRIEF:"):
                current_section = "brief"
                content_brief = line.replace("CONTENT_BRIEF:", "").strip()
                
            elif line.startswith("RESEARCH_NEEDED:"):
                current_section = "research"
                
            elif current_section == "company" and line:
                company_info += " " + line
                
            elif current_section == "brief" and line:
                content_brief += " " + line
        
        final_task = f"{task}\n\nCONTENT BRIEF: {content_brief}"
        
        log_agent_action("manager", "Task analysis complete", f"Company: {company_info[:100]}...")
        log_activity("Manager", f"Extracted company info: {company_info[:120]}", "", "info")
        log_activity("Manager", "Handing off to Researcher", "", "handoff")
        
        return {
            **state,
            "company_info": company_info,
            "task": final_task,
            "current_agent": "researcher",
            "error": None
        }
    
    except Exception as e:
        error_msg = create_error_message("manager", e)
        print(error_msg)
        return {
            **state,
            "error": error_msg,
            "current_agent": "manager"
        }