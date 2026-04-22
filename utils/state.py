from typing import TypedDict, Annotated, List, Optional
import operator

class AgentState(TypedDict):

    task: str

    company_info: str

    research_results: str

    messages: List[str]

    feedback: str

    approved: bool

    scheduled_times: List[str]

    posted_message_ids: Annotated[List[str], operator.add]

    current_agent: str

    error: Optional[str]

    revision_count: int