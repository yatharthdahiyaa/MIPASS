"""VoiceAgent: translate text into several Indian languages and speak each one, using Sarvam AI.

- POST /voice/translate          {"text", "source"?: "en", "targets"?: ["en","hi","bn","ta","te"], "style"?, "speaker"?}
- GET  /voice/<voice_id>         stored record: translated text, audio URLs, warnings
- GET  /voice/<voice_id>/<lang>.wav
- agent 'voice_translate'        same inputs as POST /voice/translate

Languages: en hi bn ta te kn ml mr gu pa od.
Styles: formal, modern-colloquial (default), classic-colloquial, code-mixed.
Speaker: a Bulbul v3 voice name; Sarvam's default voice when omitted.
The text is sent to Sarvam AI. Translations are machine output and not clinically verified.

Env: SARVAM_API_KEY, VOICE_AGENT_DIR (default <repo>/data/voice).
"""

from registry import agent

from .pipeline import DEFAULT_SOURCE, DEFAULT_STYLE, DEFAULT_TARGETS, MAX_CHARS, translate_and_speak
from .routes import voice_bp
from .sarvam import LANGUAGES, STYLES

__all__ = ["voice_bp", "translate_and_speak"]


@agent(
    "voice_translate",
    description="Translates text into several Indian languages and speaks each one (Sarvam AI).",
    inputs={
        "type": "object",
        "properties": {
            "text": {"type": "string", "maxLength": MAX_CHARS, "description": "Text to translate and speak."},
            "source": {"type": "string", "enum": list(LANGUAGES), "default": DEFAULT_SOURCE, "description": "Language of the text."},
            "targets": {
                "type": "array",
                "items": {"type": "string", "enum": list(LANGUAGES)},
                "default": list(DEFAULT_TARGETS),
                "description": "Languages to produce. The source language is spoken without translating.",
            },
            "style": {
                "type": "string",
                "enum": list(STYLES),
                "default": DEFAULT_STYLE,
                "description": "Wording style. modern-colloquial keeps common English words; formal translates fully.",
            },
            "speaker": {"type": "string", "description": "Bulbul v3 voice name, e.g. shubh (default), ritu, priya."},
        },
        "required": ["text"],
    },
)
def voice_translate(inputs, backend):
    return translate_and_speak(
        inputs.get("text"),
        source=inputs.get("source"),
        targets=inputs.get("targets"),
        style=inputs.get("style"),
        speaker=inputs.get("speaker"),
    )
