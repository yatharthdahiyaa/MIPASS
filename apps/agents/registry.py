"""Agent registry: add agents with the @agent decorator.

An agent is a function ``(inputs: dict, backend: BackendClient) -> dict``. ``inputs`` on the decorator is the
JSON Schema of that dict; GET /agents publishes it and mcp_server.py turns it into the MCP tool's input schema.

    from registry import agent

    @agent("echo", description="Returns its inputs.", inputs={"type": "object", "properties": {"text": {"type": "string"}}})
    def echo(inputs, backend):
        return {"echo": inputs}
"""

from dataclasses import dataclass
from typing import Any, Callable

from backend_client import BackendClient

AgentFn = Callable[[dict[str, Any], BackendClient], dict[str, Any]]


@dataclass
class AgentSpec:
    key: str
    description: str
    fn: AgentFn
    inputs: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {"key": self.key, "description": self.description, "inputs": self.inputs}


AGENTS: dict[str, AgentSpec] = {}


def agent(key: str, description: str = "", inputs: dict[str, Any] | None = None) -> Callable[[AgentFn], AgentFn]:
    def register(fn: AgentFn) -> AgentFn:
        if key in AGENTS:
            raise ValueError(f"agent '{key}' is already registered")
        AGENTS[key] = AgentSpec(key, description, fn, inputs or {"type": "object"})
        return fn

    return register
