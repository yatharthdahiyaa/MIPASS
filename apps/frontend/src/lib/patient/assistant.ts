/**
 * Patient assistant API (apps/agents/chat_server.py). Calls go through the /api/chat rewrite in
 * next.config.ts, so the session cookie stays first-party; the service checks it with the backend.
 */
import type { Locale } from '@/lib/i18n/config';

const CHAT_PREFIX = '/api/chat';

export interface AssistantAttachment {
  kind: 'audio' | 'image';
  url: string;
  language?: string;
  label?: string;
}

export interface ChatReply {
  conversation_id: string;
  /** The conversation the client asked for had expired, so this reply starts a new one. */
  restarted: boolean;
  reply: string;
  attachments: AssistantAttachment[];
  tools: { name: string; ok: boolean }[];
}

export interface AssistantUpload {
  upload_id: string;
  filename: string | null;
  warnings: string[];
  preview: string;
}

/** `status` is 0 when the service could not be reached. */
export class AssistantError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${CHAT_PREFIX}${path}`, { credentials: 'same-origin', cache: 'no-store', ...init });
  } catch {
    throw new AssistantError('network error', 0);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON (e.g. proxy error page)
  }
  if (!res.ok || body === null) {
    const error = body && typeof body === 'object' && 'error' in body ? String(body.error) : `HTTP ${res.status}`;
    throw new AssistantError(error, res.status);
  }
  return body as T;
}

const postJson = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const assistantApi = {
  chat: (input: { conversation_id: string | null; message: string; language: Locale; upload_id?: string }) =>
    call<ChatReply>('/chat', postJson(input)),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return call<AssistantUpload>('/upload', { method: 'POST', body: form });
  },
  speak: (text: string, language: Locale) => call<{ audio: string }>('/speak', postJson({ text, language })),
};

/** The service returns its files as paths (/media/...); the browser loads them through the same rewrite. */
export const mediaUrl = (path: string) => `${CHAT_PREFIX}${path}`;
