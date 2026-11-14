"""Care agents: work on record data the MIPAAS backend prepared, for the person who asked.

The backend (apps/backend/app/services/agents.py) decides who may run what, reads the input under
that person's permissions, removes identifiers, and says whether a language model may see it
(``llm_allowed``: the patient consented). These agents compute the result with rules, optionally
let the model reword it, check that wording (guard.py) and return it. They keep nothing.

Every agent takes {"input": {...}, "llm_allowed": bool} and returns its result plus "_meta"
({llm_used, llm_model, guard}), which the backend stores in the run log and strips.

- report_explainer   patient: a signed report in plain words, its terms, questions for the doctor
- consult_brief      doctor: what a patient shared, sorted by what needs attention
- report_draft       doctor: a draft impression from the AI screen, with graded certainty
"""

from registry import agent

from . import consult_brief, report_draft, report_explainer

_ENVELOPE = {
    "type": "object",
    "properties": {
        "input": {"type": "object", "description": "Prepared by the MIPAAS backend; see the agent's module."},
        "llm_allowed": {"type": "boolean", "default": False, "description": "The patient allowed a language model to see this data."},
    },
    "required": ["input"],
}


@agent("report_explainer", description="Explains a signed report to the patient in plain words.", inputs=_ENVELOPE)
def _report_explainer(inputs, backend):
    return report_explainer.run(inputs)


@agent("consult_brief", description="Pre-consultation brief of what a patient shared, for their doctor.", inputs=_ENVELOPE)
def _consult_brief(inputs, backend):
    return consult_brief.run(inputs)


@agent("report_draft", description="Draft impression for a study from its AI screen, for the doctor to edit.", inputs=_ENVELOPE)
def _report_draft(inputs, backend):
    return report_draft.run(inputs)
