"""
MIPAAS Agent Framework Base.

Enforces strict autonomy levels, clinical safety invariants,
allowlisted tool execution, structured output schemas, and safe failure behaviors.
"""

from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set
import structlog

logger = structlog.get_logger()


class AgentAutonomy(str, Enum):
    """Autonomy tiers across the MIPAAS platform."""
    L0 = "L0"  # Suggests only (passive, non-binding drafts/summaries)
    L1 = "L1"  # Acts after human approval (requires clinician/operator sign-off)
    L2 = "L2"  # Acts alone (STRICTLY NON-CLINICAL tasks only)


class ClinicalSafetyViolation(Exception):
    """Raised when an agent violates clinical safety invariants."""
    pass


class ToolExecutionError(Exception):
    """Raised when an agent attempts to call a non-allowlisted tool."""
    pass


class AgentBase:
    """Base class for all MIPAAS autonomous and assistive agents."""

    def __init__(
        self,
        name: str,
        goal: str,
        autonomy: AgentAutonomy,
        is_clinical: bool = False,
        uses_llm: bool = False,
        allowed_tools: Optional[Set[str]] = None,
        github_repo: Optional[str] = None,
        repo_name: Optional[str] = None,
        upstream_framework: Optional[str] = None,
        benchmark_reference: Optional[str] = None,
        core_algorithms: Optional[List[str]] = None,
    ):
        self.name = name
        self.goal = goal
        self.autonomy = autonomy
        self.is_clinical = is_clinical
        self.uses_llm = uses_llm
        self.allowed_tools = allowed_tools or set()
        self.github_repo = github_repo
        self.repo_name = repo_name
        self.upstream_framework = upstream_framework
        self.benchmark_reference = benchmark_reference
        self.core_algorithms = core_algorithms or []

        # Enforce Clinical Invariant: No agent may reach L2 on anything clinical
        if self.is_clinical and self.autonomy == AgentAutonomy.L2:
            raise ClinicalSafetyViolation(
                f"Agent '{self.name}' declared as clinical with autonomy L2. "
                "CRITICAL INVARIANT: No agent may reach L2 on anything clinical."
            )

        self._tools_registry: Dict[str, Callable[..., Any]] = {}

    def to_metadata(self) -> Dict[str, Any]:
        """Return standardized agent definition including upstream GitHub repository provenance."""
        return {
            "name": self.name,
            "goal": self.goal,
            "autonomy": self.autonomy.value,
            "is_clinical": self.is_clinical,
            "uses_llm": self.uses_llm,
            "allowed_tools": list(self.allowed_tools),
            "github_repo": self.github_repo,
            "repo_name": self.repo_name,
            "upstream_framework": self.upstream_framework,
            "benchmark_reference": self.benchmark_reference,
            "core_algorithms": self.core_algorithms,
        }

    def register_tool(self, tool_name: str, fn: Callable[..., Any]) -> None:
        """Register a callable implementation for an allowlisted tool."""
        if tool_name not in self.allowed_tools:
            raise ToolExecutionError(
                f"Tool '{tool_name}' is not in the allowlist for agent '{self.name}'. "
                f"Allowlist: {list(self.allowed_tools)}"
            )
        self._tools_registry[tool_name] = fn

    def call_tool(self, tool_name: str, *args: Any, **kwargs: Any) -> Any:
        """Invoke an allowlisted tool with strict security checks."""
        if tool_name not in self.allowed_tools:
            raise ToolExecutionError(
                f"Security violation: Agent '{self.name}' attempted to invoke unapproved tool '{tool_name}'."
            )
        if tool_name not in self._tools_registry:
            raise ToolExecutionError(f"Tool '{tool_name}' is approved but not implemented.")

        logger.info("agent_tool_invoked", agent=self.name, tool=tool_name)
        return self._tools_registry[tool_name](*args, **kwargs)

    def execute(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute the agent workflow and return standardized schema."""
        context = context or {}
        try:
            return self._run(inputs, context)
        except Exception as e:
            logger.error("agent_execution_failure", agent=self.name, error=str(e))
            return self.fallback(inputs, context, str(e))

    def _run(self, inputs: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Concrete agent logic to be implemented by subclasses."""
        raise NotImplementedError

    def fallback(self, inputs: Dict[str, Any], context: Dict[str, Any], error_message: str) -> Dict[str, Any]:
        """Safe fallback behavior when primary workflow fails."""
        raise NotImplementedError
