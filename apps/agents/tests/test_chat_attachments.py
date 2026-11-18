"""The chat service turns the X-ray agent's Grad-CAM overlays into image attachments.

Runs in the chat service's environment (.venv-mcp); skipped where its packages are missing.
"""

import json

import pytest

pytest.importorskip("mcp")
pytest.importorskip("starlette")

import chat_server  # noqa: E402


def _files():
    return chat_server.PatientFiles()


def _result(overlay: str, upload_id: str = "abc123") -> str:
    return json.dumps(
        {
            "upload_id": upload_id,
            "gradcam": [{"name": "Pleural Effusion", "probability": 0.95, "overlay": overlay}],
        }
    )


def test_overlay_as_the_mcp_server_sends_it_is_attached():
    # mcp_server.py rewrites agent file paths to full agents-server URLs.
    url = f"{chat_server.AGENTS_URL}/xai/abc123/image/Pleural_Effusion.png"
    out = chat_server._attachments("xai_cxr_report", _result(url), _files())
    assert out == [{"kind": "image", "label": "Pleural Effusion", "url": "/media/xai/abc123/image/Pleural_Effusion.png"}]


def test_overlay_as_a_plain_path_is_attached():
    out = chat_server._attachments("xai_cxr_report", _result("/xai/abc123/image/Pleural_Effusion.png"), _files())
    assert [a["url"] for a in out] == ["/media/xai/abc123/image/Pleural_Effusion.png"]


@pytest.mark.parametrize(
    "overlay",
    [
        "/xai/someone_else/image/Pleural_Effusion.png",  # another upload
        "https://evil.example/xai/abc123/image/x.png",  # another host
        "/xai/abc123/image/../../../etc/passwd",  # path tricks
        None,
    ],
)
def test_overlays_outside_this_upload_are_not_attached(overlay):
    assert chat_server._attachments("xai_cxr_report", _result(overlay), _files()) == []
