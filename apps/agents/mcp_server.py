"""MCP server that exposes every MIPAAS agent as a tool.

Tools come from the agents server's registry (GET /agents), so a new @agent shows up here with no changes;
each call runs POST /agents/<key>/run there. upload_image is the one extra tool: it sends a local image to
POST /upload so the image agents get an upload_id.

The agents server must be running (python server.py). This server speaks MCP over stdio and has its own
venv at the repo root, which keeps the SDK's dependencies out of the agents' environment and keeps the venv
out of the agents server's auto-reload watch. From the repo root:

    python -m venv .venv-mcp
    .venv-mcp\\Scripts\\python -m pip install -r apps\\agents\\requirements-mcp.txt
    .venv-mcp\\Scripts\\python apps\\agents\\mcp_server.py

Env: MIPAAS_AGENTS_URL (default http://127.0.0.1:8100), AGENTS_SERVICE_KEY (sent as X-Agents-Key).
"""

import json
import os
import re
from pathlib import Path
from urllib.parse import quote

import anyio
import requests
from mcp import MCPError, types
from mcp.server.lowlevel import Server
from mcp.server.stdio import stdio_server

AGENTS_URL = os.getenv("MIPAAS_AGENTS_URL", "http://127.0.0.1:8100").rstrip("/")
SERVICE_HEADERS = {"X-Agents-Key": os.environ["AGENTS_SERVICE_KEY"]} if os.getenv("AGENTS_SERVICE_KEY") else {}
RUN_TIMEOUT = 900  # an XAI report with the Grok review can take several minutes

INSTRUCTIONS = (
    "These tools run MIPAAS agents on the local agents server. Image agents take an upload_id: call upload_image "
    "with the image's file path first. Results are machine output for clinician review, not diagnoses."
)

UPLOAD_TOOL = types.Tool(
    name="upload_image",
    description="Uploads a local image (PNG, JPEG, BMP, TIFF or DICOM) to the agents server and returns its "
    "upload_id with a quality report. Image agents take that upload_id.",
    input_schema={
        "type": "object",
        "properties": {"path": {"type": "string", "description": "Path of the image file on this machine."}},
        "required": ["path"],
    },
)

_SERVED_FILE = re.compile(r"^/(upload|xai|voice)/")


class AgentsError(Exception):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


def _request(method: str, path: str, **kwargs) -> dict:
    try:
        resp = requests.request(method, AGENTS_URL + path, headers=SERVICE_HEADERS, **kwargs)
    except requests.RequestException as exc:
        raise AgentsError(f"agents server not reachable at {AGENTS_URL}; start it with: python server.py ({exc})") from exc
    try:
        body = resp.json()
    except ValueError:
        body = None
    if not resp.ok:
        message = body.get("error") if isinstance(body, dict) else None
        raise AgentsError(f"agents server {resp.status_code}: {message or resp.text[:500]}", resp.status_code)
    return body


def _absolute(value):
    """The agents server returns its files as paths (/voice/<id>/hi.wav); give clients full URLs."""
    if isinstance(value, dict):
        return {k: _absolute(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_absolute(v) for v in value]
    if isinstance(value, str) and _SERVED_FILE.match(value):
        return AGENTS_URL + value
    return value


def _upload(path) -> dict:
    if not isinstance(path, str) or not path.strip():
        raise AgentsError("path is required")
    file = Path(path).expanduser()
    if not file.is_file():
        raise AgentsError(f"no file at {file}")
    with file.open("rb") as f:
        return _request("POST", "/upload", files={"file": (file.name, f)}, timeout=120)


def _run(name: str, arguments: dict) -> dict:
    if name == UPLOAD_TOOL.name:
        return _upload(arguments.get("path"))
    return _request("POST", f"/agents/{quote(name, safe='')}/run", json=arguments, timeout=RUN_TIMEOUT)["result"]


async def list_tools(ctx, params) -> types.ListToolsResult:
    try:
        listing = await anyio.to_thread.run_sync(lambda: _request("GET", "/agents", timeout=10))
    except AgentsError as exc:
        raise MCPError(types.INTERNAL_ERROR, str(exc)) from exc
    agents = [types.Tool(name=a["key"], description=a["description"], input_schema=a["inputs"]) for a in listing["agents"]]
    return types.ListToolsResult(tools=[UPLOAD_TOOL, *agents])


async def call_tool(ctx, params: types.CallToolRequestParams) -> types.CallToolResult:
    try:
        result = await anyio.to_thread.run_sync(_run, params.name, params.arguments or {})
    except AgentsError as exc:
        if exc.status == 404 and params.name != UPLOAD_TOOL.name:
            raise MCPError(types.INVALID_PARAMS, f"unknown tool '{params.name}'") from exc
        return types.CallToolResult(content=[types.TextContent(text=str(exc))], is_error=True)
    text = json.dumps(_absolute(result), ensure_ascii=False, indent=2)
    return types.CallToolResult(content=[types.TextContent(text=text)])


server = Server(
    "mipaas-agents",
    version="0.1.0",
    instructions=INSTRUCTIONS,
    on_list_tools=list_tools,
    on_call_tool=call_tool,
)


async def main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    anyio.run(main)
