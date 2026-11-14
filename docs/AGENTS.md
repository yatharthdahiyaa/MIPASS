# AI agents

How MIPAAS uses AI agents, what each one does, and how to add one.

## The rule

**Every agent prepares; a person decides.** An agent may summarise, draft, explain or sort. It
never diagnoses, prescribes, or sends anything to another person by itself. Every agent gives a
useful answer from rules alone. A language model only rewords that answer, only with the
patient's permission, and its text is checked before anyone sees it.

## The agents

| Agent | For | What it gives | Where | Who decides |
|---|---|---|---|---|
| `record_assistant` | Patient | The health assistant answers from the patient's own readings, medicines, reports, X-rays and appointments instead of guessing, and is told when an X-ray is added, reviewed or deleted | Web: the assistant in the patient portal | Read-only |
| `report_explainer` | Patient | A signed report in plain words: the medical terms it uses, questions for the doctor, a prompt to contact the doctor if the report marks something serious; with consent, a short summary in the patient's language | Web: Records → Reports from your doctors | The report was already signed |
| `consult_brief` | Doctor | One screen of what the patient shared, "needs attention" first: readings beyond alert limits, missed doses, unreviewed flagged X-rays, allergies, unread messages; then vitals trends, medicines, imaging, background, what is not shared | Desktop: patient record and consultation | The doctor reads it; nothing is sent |
| `report_draft` | Doctor | A draft impression from the AI screen, each finding graded "consistent with", "suspicious for" or "possible" by how far it is above the model's threshold, borderline findings to check, and common follow-up suggestions. Rules only: no language model | Desktop: study view, "Draft with AI" | The doctor edits and signs |

The earlier agents (`upload_enhance`, `xai_cxr_report`, `voice_translate`) are still available to
the patient chat and over MCP. `xai_cxr_report` now scores X-rays with the CheXpert ensemble the
backend uses (`docs/CHEST_XRAY_MODEL.md`).

## How a run works

```
person ──> MIPAAS API ──────────────────────────────> agents service ──> (model, optional)
           1 catalogue: does this agent exist,          5 rules first
             is it for this person, is it switched on   6 model rewords, only if allowed
           2 permission: read the input under this      7 safety check on the model's text
             person's own rights (own record, or what
             the patient shared over an active link)
           3 minimise: no names, contact details,
             dates of birth, free-text notes, titles
             or message bodies
           4 consent: may a model see this patient's
             data?
           8 record the run <────────────────────────── result + what happened
           9 the person accepts, edits or discards; that is recorded too
```

- **Code:** steps 1 to 4, 8 and 9 are in `apps/backend/app/services/agents.py`; steps 5 to 7
  are in `apps/agents/CareAgents/`.
- **Run log:** the `agent_runs` table. It stores who ran the agent, whose record it was about,
  whether a model saw data and which one, whether the safety check withheld the model's text,
  how long it took, and the review decision. A doctor's final edited text is kept for drafts.
  Rows about a patient are deleted with the patient's account.
- **Asynchronous runs:** a run returns at once (`202`) and finishes in a background thread. The
  client polls `GET /agents/runs/<id>`, and a run stuck for ten minutes is marked failed.

### Consent

Patients decide under **Account → AI assistance** (`users.ai_consent_at`).
- **Off (the default):** the explainer and the brief still work from rules, and nothing leaves
  MIPAAS for a model. The health assistant can't read the record; the chat itself already goes
  to the chat provider.
- **On:** the minimised input may go to the provider named in `AGENTS_LLM_NOTICE`.
- **Doctors' agents use the patient's consent:** a brief or draft about a patient who said no is
  rules-only. A study not linked to any patient account is also rules-only.

### The safety check

`CareAgents/guard.py` runs on every piece of model text. If it fails, the text is withheld, the
rule-based answer is returned on its own, and the reason is recorded.

- **All text:** any number above 12 must appear in the data the model was given.
- **Patient-facing text, also:**
  - no instructions about medicines or doses,
  - no "you have ...",
  - no reassurance that could delay care,
  - no links.
- **Other languages:** the model also returns an English version, and the phrase rules check that.
- **"You have" in context:** "any symptoms you have" and "if you have questions" pass; "the
  report says that you have pneumonia" does not.
- **Briefs:** a brief may not claim an absence ("no allergies", "no symptoms", "no medicines")
  unless the computed facts say so. An area the patient didn't share is unknown, not empty.
- **Rate limits:** the model client waits out a provider rate limit (up to 20 seconds, three
  attempts) before the agent falls back to its rule-based answer.

### Record updates (Redis)

The patient chat knows about X-rays the patient adds on the X-rays page, not only ones attached in the chat.

```
X-rays page ──> API: save, run the model, commit ──> Redis stream mipaas:patient:<id>:events
                                                          │  {type: xray.added | xray.reviewed | xray.deleted,
                                                          │   study_id, status, severity, urgency, at}
patient sends a chat message ──> chat service: read events after this conversation's cursor
                                 ──> API section=xrays, with the patient's session (consent check, logged)
                                 ──> a "record update" note for the model, before the patient's message
```

- **Code:** `app/services/events.py` (API), `apps/agents/record_events.py` and `_record_update` in
  `chat_server.py` (chat).
- **Ids only in Redis:** events hold ids and status, never findings, titles or names. The findings come
  from the API, which checks consent like any other record read. Without consent the model is told nothing.
- **After the commit:** an event is sent only once its database change is saved. A failed chat turn is
  retried with the same update; the cursor moves only after a successful turn.
- **New conversations** hear about the last 24 hours. Each stream keeps 100 events, expires 7 days after
  the last one, and is deleted with the account.
- **Redis is optional:** without `REDIS_URL`, or with Redis down, uploads still work and the assistant can
  still read X-rays through `my_health_record` (section `xrays`); it just isn't told what changed.
- **Not covered yet:** vitals, medicines, documents and messages. Add an event type in the API and a line
  in `_change_line` to route another kind of change.

### Service security

- The agents service accepts calls only with `X-Agents-Key: AGENTS_SERVICE_KEY`. Without the
  variable it accepts calls from its own machine only.
- The API sends the key, and so do the chat service and the MCP server.
- Outside development, the API refuses to start with `AGENTS_URL` set and no key of at least 32
  characters.

## Settings

| Where | Variable | Meaning |
|---|---|---|
| API | `AGENTS_URL` | Agents service address. Empty: agents are off, except the health assistant's record access |
| API, agents, chat | `AGENTS_SERVICE_KEY` | Shared secret |
| API | `AGENTS_DISABLED` | Comma-separated agent keys to switch off without a release |
| API | `AGENTS_LLM_NOTICE` | Who sees data under consent, shown to patients |
| API, chat | `REDIS_URL` | Record updates for the patient chat (and the API's shared rate limits). Same Redis for both |
| Agents | `AGENT_LLM_PROVIDER` | `groq`, `xai` or `off`. Unset: `CHAT_PROVIDER`, else `groq`. The production stack sets `off` unless you change it |
| Agents | `GROQ_API_KEY`, `XAI_API_KEY`, `AGENT_LLM_MODEL` | Provider credentials and model |

Production: set the agents variables in `infra/deploy/.env` and add `--profile agents`.

## Measuring

**Admin → AI agents** shows, for each agent:
- runs and failures,
- how often a model was used,
- how often its text was withheld,
- what people did with the results (kept, edited, discarded),
- the median time.

These numbers decide what to build next. A draft that doctors mostly discard, or a summary that is
often withheld, needs fixing before anything new is added.

## Adding an agent

1. **Agent code:** write the rules in `apps/agents/CareAgents/<name>.py` with a
   `run(inputs) -> dict`. The model step is optional and always goes through
   `guard.check`. Return `_meta` with `llm_used`, `llm_model` and `guard`.
2. **Registration:** register it in `CareAgents/__init__.py` with `@agent`.
3. **API side:** add it to `CATALOG` in `app/services/agents.py` with its audience, and write
   its input builder. The builder reads data only through existing permission checks and
   removes identifiers.
4. **Test cases:**
   - in `apps/agents/tests/`, cover its rules, an unsafe model reply that must be withheld, and
     a case with no consent;
   - in `apps/backend/tests/test_agents.py`, cover who may run it and what must never be sent.
5. **Screen:** show the result clearly labelled as an AI agent, with a way to accept, edit or
   discard it.

## Checking the agents against the real model

`apps/agents/evals/run_live.py` runs the explainer and the brief on realistic, made-up cases
(`evals/cases.py`) with the configured model and scores each one: the text must be shown (not
withheld, not failed) and contain what the case requires.

```bash
cd apps/agents
python evals/run_live.py --repeat 3      # every case three times; exit code 1 on any failure
python evals/run_live.py explainer -v    # one agent, printing each output
```

Run it before changing a prompt, a rule or the model, and add a case whenever an agent gets
something wrong in use. It is not in CI: it needs a provider key and costs tokens.

What the first real runs (Groq `openai/gpt-oss-120b`, November 2026) changed:
- **The draft agent lost its model step.** Without the image the model could only reshuffle the
  rule-based lines, and it wrote "Cardiomegaly consistent with cardiomegaly".
- **The explainer was flattening the doctor's hedging** ("in keeping with pneumonia" became "there is
  an infection") and repeating jargon. Its prompt now keeps the level of certainty and every
  number as written.
- **The brief editorialised** ("indicating suboptimal control") and once said "No allergies"
  for a patient who had shared only vitals. The prompt now forbids both, and the second is also
  a hard rule.
- **The safety check blocked good text** containing "any symptoms you have".
- **The provider's rate limit was hit** within one batch; the client now waits and retries.
- **Missing dose ticks are not non-adherence.** A month with no doses marked is reported as
  "may not be using the dose checklist", not as 0% adherence.

The patient chat's record tool was also run live: it reads readings, medicines and reports with
consent, tells the patient how to turn consent on without it, and declines to advise on doses.

## Not done yet

- **Judged by one person on eighteen cases.** The outputs read well to an engineer. A clinician
  and a native speaker of each language need to review real samples before patients rely on them.
- **English only:** the explainer's term list is English, and the phrase rules read English;
  other languages rely on the model's English version.
- **The chat service is not in the production stack.**
- **Runs are lost on a restart:** they use a thread pool in the API process, so a restart mid-run
  leaves it to the ten-minute stale rule. Move to a job queue before heavy use.
- **Regulatory question:** a draft impression puts AI-suggested text into a signed medical report.
  Confirm the regulatory position before enabling `report_draft` for real patients (switch it off
  with `AGENTS_DISABLED=report_draft`).
