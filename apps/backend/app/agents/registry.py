"""
MIPAAS Agent Registry & Orchestrator.

Provides unified discovery, registration, and dispatch for all 9 platform agents.
"""

from typing import Any, Dict, Optional
from app.agents.base import AgentBase
from app.agents.intake_quality import IntakeQualityAgent
from app.agents.routing import RoutingAgent
from app.agents.triage_escalation import TriageEscalationAgent
from app.agents.report_drafting import ReportDraftingAgent
from app.agents.longitudinal import LongitudinalComparisonAgent
from app.agents.referral_followup import ReferralFollowupAgent
from app.agents.consent_privacy import ConsentPrivacyAgent
from app.agents.model_qa import ModelQAAgent
from app.agents.support import SupportAgent


class AgentOrchestrator:
    """Central registry and dispatch engine for MIPAAS agents."""

    def __init__(self):
        self._agents: Dict[str, AgentBase] = {
            "intake_quality": IntakeQualityAgent(),
            "routing": RoutingAgent(),
            "triage_escalation": TriageEscalationAgent(),
            "report_drafting": ReportDraftingAgent(),
            "longitudinal": LongitudinalComparisonAgent(),
            "referral_followup": ReferralFollowupAgent(),
            "consent_privacy": ConsentPrivacyAgent(),
            "model_qa": ModelQAAgent(),
            "support": SupportAgent(),
        }

    def get_agent(self, agent_key: str) -> Optional[AgentBase]:
        return self._agents.get(agent_key)

    def list_agents(self) -> Dict[str, Dict[str, Any]]:
        return {
            key: agent.to_metadata()
            for key, agent in self._agents.items()
        }

    def dispatch(self, agent_key: str, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        agent = self.get_agent(agent_key)
        if not agent:
            raise KeyError(f"Unknown agent: '{agent_key}'. Available: {list(self._agents.keys())}")
        return agent.execute(inputs, context)


# Singleton orchestrator instance
agent_orchestrator = AgentOrchestrator()
