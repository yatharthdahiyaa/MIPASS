/**
 * AI agents API client (apps/backend/app/routes/agents.py).
 * The backend decides what each agent may read; an outside AI model sees a patient's data only
 * if that patient allowed it (`consent`).
 */
import { apiCall } from '@/lib/auth/api';

export interface AgentInfo {
  key: string;
  title: string;
  description: string;
  version: string;
  enabled: boolean;
}

export interface AgentConsent {
  consented: boolean;
  consented_at: string | null;
  /** Who would see the data, in words the patient can judge. */
  provider_notice: string;
}

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type ReviewDecision = 'accepted' | 'edited' | 'discarded';

export interface AgentRun<T = unknown> {
  id: string;
  agent: string;
  version: string;
  status: RunStatus;
  output: T | null;
  error: string | null;
  /** An outside AI model saw (minimised) data for this run. */
  llm_used: boolean;
  /** Why the model's text was withheld by the safety check, if it was. */
  guard: string | null;
  review_decision: ReviewDecision | null;
  created_at: string | null;
  duration_ms: number | null;
}

export interface ReportExplanation {
  summary: string | null;
  language: string;
  terms: { term: string; meaning: string }[];
  questions: string[];
  attention: string | null;
  notice: string;
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const agentsApi = {
  list: () => apiCall<{ agents: AgentInfo[]; consent?: AgentConsent }>('/agents'),
  consent: () => apiCall<AgentConsent>('/agents/consent'),
  setConsent: (allow: boolean) => apiCall<AgentConsent>('/agents/consent', json('PUT', { allow })),
  start: <T>(key: string, params: Record<string, unknown>) =>
    apiCall<{ run: AgentRun<T> }>(`/agents/${key}/runs`, json('POST', { params })),
  get: <T>(id: string) => apiCall<{ run: AgentRun<T> }>(`/agents/runs/${id}`),
  review: (id: string, decision: ReviewDecision, finalText?: string) =>
    apiCall<{ run: AgentRun }>(`/agents/runs/${id}/review`, json('POST', { decision, final_text: finalText })),
};

/** Starts a run and polls until it has finished (or the signal aborts). */
export async function runAgent<T>(key: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<AgentRun<T>> {
  let { run } = await agentsApi.start<T>(key, params);
  let wait = 700;
  while (run.status === 'queued' || run.status === 'running') {
    await new Promise((r) => setTimeout(r, wait));
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    wait = Math.min(wait * 1.4, 2500);
    ({ run } = await agentsApi.get<T>(run.id));
  }
  return run;
}
