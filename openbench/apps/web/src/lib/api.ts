"use client";

import type {
  Document,
  DocumentDetail,
  HandoverReport,
  Me,
  PhotoAssessment,
  Protocol,
  ProtocolVersion,
  ProtocolVersionDetail,
  Run,
  RunDetail,
  TokenPair,
  Deviation,
} from "@openbench/schemas";

const API_BASE =
  (typeof window !== "undefined"
    ? (window as any).__OPENBENCH_API__ || process.env.NEXT_PUBLIC_API_BASE_URL
    : process.env.NEXT_PUBLIC_API_BASE_URL) || "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string, public payload?: unknown) {
    super(message);
  }
}

type FetchOptions = {
  method?: string;
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  withAuth?: boolean;
  orgId?: string;
};

/**
 * Token storage migration: tokens live in `sessionStorage` (cleared when the
 * tab closes), not `localStorage`. We migrate any legacy localStorage tokens on
 * first read so existing sessions don't break.
 */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  const sessionToken = window.sessionStorage.getItem("openbench.token");
  if (sessionToken) return sessionToken;
  const legacyToken = window.localStorage.getItem("openbench.token");
  if (legacyToken) {
    window.sessionStorage.setItem("openbench.token", legacyToken);
    window.localStorage.removeItem("openbench.token");
  }
  const legacyRefresh = window.localStorage.getItem("openbench.refresh");
  if (legacyRefresh) {
    window.sessionStorage.setItem("openbench.refresh", legacyRefresh);
    window.localStorage.removeItem("openbench.refresh");
  }
  return legacyToken || null;
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("openbench.refresh") || null;
}

function getOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("openbench.orgId") || null;
}

export function setAuth(pair: TokenPair, refresh = true) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem("openbench.token", pair.access_token);
  if (refresh) window.sessionStorage.setItem("openbench.refresh", pair.refresh_token);
  window.localStorage.removeItem("openbench.token");
  window.localStorage.removeItem("openbench.refresh");
}

export function setOrgId(orgId: string | null) {
  if (typeof window === "undefined") return;
  if (orgId) window.localStorage.setItem("openbench.orgId", orgId);
  else window.localStorage.removeItem("openbench.orgId");
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem("openbench.token");
  window.sessionStorage.removeItem("openbench.refresh");
  window.localStorage.removeItem("openbench.token");
  window.localStorage.removeItem("openbench.refresh");
  window.localStorage.removeItem("openbench.orgId");
}

// Single-flight refresh: if many requests 401 at once we want exactly one
// /auth/refresh call in flight. Subsequent 401s await the same promise.
let _refreshInFlight: Promise<boolean> | null = null;

async function _doRefresh(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const refresh = window.sessionStorage.getItem("openbench.refresh");
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) {
      clearAuth();
      return false;
    }
    const pair = (await res.json()) as TokenPair;
    setAuth(pair, true);
    return true;
  } catch {
    clearAuth();
    return false;
  }
}

async function _refreshOnce(): Promise<boolean> {
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = _doRefresh().finally(() => {
    _refreshInFlight = null;
  });
  return _refreshInFlight;
}

export async function api<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.body && !opts.formData) headers["Content-Type"] = "application/json";
  if (opts.withAuth !== false) {
    const tok = getStoredToken();
    if (tok) headers["Authorization"] = `Bearer ${tok}`;
    const org = opts.orgId ?? getOrgId();
    if (org) headers["X-Org-Id"] = org;
  }
  const url = `${API_BASE}${path}`;
  const method = opts.method || (opts.body || opts.formData ? "POST" : "GET");
  const body = opts.formData ? opts.formData : opts.body ? JSON.stringify(opts.body) : undefined;
  let res = await fetch(url, { method, headers, body, signal: opts.signal });
  // 401 → try one refresh + retry. We deliberately skip retry for the
  // login/register/refresh/logout endpoints to avoid accidentally retrying a
  // wrong-credential login.
  if (
    res.status === 401 &&
    opts.withAuth !== false &&
    !path.startsWith("/api/auth/")
  ) {
    const ok = await _refreshOnce();
    if (ok) {
      const tok = getStoredToken();
      const retryHeaders = { ...headers };
      if (tok) retryHeaders["Authorization"] = `Bearer ${tok}`;
      res = await fetch(url, { method, headers: retryHeaders, body, signal: opts.signal });
    }
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    let payload: unknown = null;
    try {
      payload = await res.json();
      const d = (payload as any)?.detail;
      if (typeof d === "string") detail = d;
      else if (d) detail = JSON.stringify(d);
    } catch {
      // body not JSON
    }
    throw new ApiError(res.status, detail, payload);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.blob()) as unknown as T;
}

// Auth -----------------------------------------------------------------------

export const auth = {
  login: (email: string, password: string) =>
    api<TokenPair>("/api/auth/login", { body: { email, password }, withAuth: false }),
  register: (data: {
    email: string;
    password: string;
    display_name: string;
    org_name: string;
    org_slug?: string;
  }) => api<TokenPair>("/api/auth/register", { body: data, withAuth: false }),
  me: () => api<Me>("/api/auth/me"),
  logout: () => {
    const refresh_token = getRefreshToken();
    return api("/api/auth/logout", {
      method: "POST",
      body: refresh_token ? { refresh_token } : undefined,
      withAuth: false,
    });
  },
};

// Documents ------------------------------------------------------------------

export const documents = {
  list: () => api<Document[]>("/api/documents"),
  uploadDirect: (file: File, suggestedType?: string, declaredVersion?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (suggestedType) fd.append("suggested_type", suggestedType);
    if (declaredVersion) fd.append("declared_version", declaredVersion);
    return api<DocumentDetail>("/api/documents/upload-direct", { formData: fd });
  },
  get: (id: string) => api<DocumentDetail>(`/api/documents/${id}`),
  remove: (id: string) => api(`/api/documents/${id}`, { method: "DELETE" }),
  downloadUrl: (id: string) => api<{ url: string }>(`/api/documents/${id}/download-url`),
};

// Protocols -----------------------------------------------------------------

export const protocols = {
  list: () => api<Protocol[]>("/api/protocols"),
  compileDraft: (document_ids: string[], name?: string) =>
    api<ProtocolVersionDetail>("/api/protocol-drafts/compile", {
      body: { document_ids, name },
    }),
  getDraft: (id: string) => api<ProtocolVersionDetail>(`/api/protocol-drafts/${id}`),
  patchDraft: (id: string, body: any) =>
    api<ProtocolVersionDetail>(`/api/protocol-drafts/${id}`, { method: "PATCH", body }),
  publishDraft: (id: string) =>
    api<{ protocol_version_id: string; version_label: string; status: string }>(
      `/api/protocol-drafts/${id}/publish`,
      { method: "POST" }
    ),
  getVersion: (id: string) => api<ProtocolVersionDetail>(`/api/protocol-versions/${id}`),
  archiveVersion: (id: string) =>
    api<ProtocolVersion>(`/api/protocol-versions/${id}/archive`, { method: "POST" }),
  listPublished: () =>
    api<ProtocolVersion[]>("/api/protocol-versions?status_filter=published"),
  diff: (a: string, b: string) =>
    api<{
      protocol_id: string;
      from_version_id: string;
      from_label: string;
      to_version_id: string;
      to_label: string;
      added_step_keys: string[];
      removed_step_keys: string[];
      modified: Array<{ step_key: string; changed_fields: string[]; from: any; to: any }>;
      added_count: number;
      removed_count: number;
      modified_count: number;
    }>(`/api/protocol-versions/${a}/diff/${b}`),
};

// Runs ----------------------------------------------------------------------

export const runs = {
  create: (protocol_version_id: string, device_id?: string) =>
    api<Run>("/api/runs", { body: { protocol_version_id, device_id } }),
  list: (status_filter?: string) =>
    api<Run[]>(`/api/runs${status_filter ? `?status_filter=${status_filter}` : ""}`),
  get: (id: string) => api<RunDetail>(`/api/runs/${id}`),
  preflight: (id: string) => api<RunDetail>(`/api/runs/${id}/preflight`, { method: "POST" }),
  start: (id: string) => api<Run>(`/api/runs/${id}/start`, { method: "POST" }),
  pause: (id: string) => api<Run>(`/api/runs/${id}/pause`, { method: "POST" }),
  resume: (id: string) => api<Run>(`/api/runs/${id}/resume`, { method: "POST" }),
  cancel: (id: string) => api<Run>(`/api/runs/${id}/cancel`, { method: "POST" }),
  startStep: (id: string, stepId: string, idem?: string) =>
    api<RunDetail>(`/api/runs/${id}/steps/${stepId}/start`, {
      body: { idempotency_key: idem },
    }),
  completeStep: (
    id: string,
    stepId: string,
    body: {
      confirmations?: Record<string, unknown>;
      measurements?: Record<string, unknown>;
      override_block?: boolean;
      override_reason?: string;
      idempotency_key?: string;
    }
  ) => api<RunDetail>(`/api/runs/${id}/steps/${stepId}/complete`, { body }),
  skipStep: (id: string, stepId: string, reason: string, idem?: string) =>
    api<RunDetail>(`/api/runs/${id}/steps/${stepId}/skip`, {
      body: { reason, idempotency_key: idem },
    }),
  addNote: (id: string, text: string, step_id?: string, idem?: string) =>
    api(`/api/runs/${id}/notes`, { body: { text, step_id, idempotency_key: idem } }),
  addMeasurement: (
    id: string,
    body: { step_id: string; key: string; value: unknown; units?: string; idempotency_key?: string }
  ) => api(`/api/runs/${id}/measurements`, { body }),
  addDeviation: (
    id: string,
    body: {
      step_id?: string;
      severity: string;
      title: string;
      description?: string;
      requires_review?: boolean;
      attachment_ids?: string[];
      idempotency_key?: string;
    }
  ) => api<Deviation>(`/api/runs/${id}/deviations`, { body }),
  startTimer: (
    id: string,
    body: { step_id?: string; label: string; duration_seconds: number; idempotency_key?: string }
  ) => api(`/api/runs/${id}/timers`, { body }),
  timerElapsed: (id: string, timerId: string) =>
    api(`/api/runs/${id}/timers/${timerId}/elapsed`, { method: "POST" }),
  requestOverride: (
    id: string,
    body: { step_id: string; category: string; reason: string; idempotency_key?: string }
  ) => api(`/api/runs/${id}/override-requests`, { body }),
  resolveOverride: (id: string, eventId: string, decision: "approved" | "denied", notes?: string) =>
    api(
      `/api/runs/${id}/override-requests/${eventId}/resolve?decision=${decision}${
        notes ? `&notes=${encodeURIComponent(notes)}` : ""
      }`,
      { method: "POST" }
    ),
  uploadAttachment: (id: string, file: File, stepId?: string, kind?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (stepId) fd.append("step_id", stepId);
    if (kind) fd.append("kind", kind);
    return api<{ id: string; storage_path: string; mime_type: string }>(
      `/api/runs/${id}/attachments`,
      { formData: fd }
    );
  },
  ask: (id: string, question: string, step_id?: string, idempotency_key?: string) =>
    api<{
      answer_text: string;
      citations: any[];
      confidence: string;
      escalation_required: boolean;
      suggested_action?: string | null;
      safety_review: any;
    }>(`/api/runs/${id}/ask`, {
      body: { question, step_id, context_mode: "current_step_only", idempotency_key },
    }),
  photoCheck: (id: string, stepId: string, attachment_id: string, idempotency_key?: string) =>
    api<PhotoAssessment>(`/api/runs/${id}/steps/${stepId}/photo-check`, {
      body: { attachment_id, idempotency_key },
    }),
  generateHandover: (id: string) =>
    api<HandoverReport>(`/api/runs/${id}/handover/generate`, { method: "POST" }),
  getHandover: (id: string) => api<HandoverReport>(`/api/runs/${id}/handover`),
  finalizeHandover: (id: string) =>
    api<HandoverReport>(`/api/runs/${id}/handover/finalize`, { method: "POST" }),
  pdfUrl: (id: string) => `${API_BASE}/api/runs/${id}/handover/pdf`,
};

// Deviations ----------------------------------------------------------------

export const deviationsApi = {
  list: (state?: string) =>
    api<Deviation[]>(`/api/deviations${state ? `?state=${state}` : ""}`),
  resolve: (id: string, resolution_state: string, note?: string) =>
    api<Deviation>(`/api/deviations/${id}/resolve`, {
      body: { resolution_state, note },
    }),
};

// Dashboard -----------------------------------------------------------------

export const dashboard = {
  stats: () =>
    api<{
      active_runs: number;
      blocked_runs: number;
      pending_handovers: number;
      completed_runs_7d: number;
      deviations_open: number;
      drafts_in_review: number;
    }>("/api/dashboard"),
  recentRuns: () =>
    api<
      {
        id: string;
        status: string;
        operator_id: string;
        protocol_version_id: string;
        started_at: string | null;
        ended_at: string | null;
      }[]
    >("/api/dashboard/recent-runs"),
};

// Admin ---------------------------------------------------------------------

export const admin = {
  members: () =>
    api<
      {
        membership_id: string;
        user: { id: string; email: string; display_name: string; status: string };
        role: string;
        team_id: string | null;
      }[]
    >("/api/admin/users"),
  invite: (email: string, display_name: string, role: string, initial_password: string) =>
    api("/api/admin/users/invite", {
      body: { email, display_name, role, initial_password },
    }),
  updateRole: (membership_id: string, role: string) =>
    api(`/api/admin/memberships/${membership_id}`, { method: "PATCH", body: { role } }),
  settings: () =>
    api<{
      org_id: string;
      name: string;
      slug: string;
      data_region: string;
      retention_policy_days: number;
    }>("/api/admin/settings"),
  patchSettings: (body: { name?: string; data_region?: string; retention_policy_days?: number }) =>
    api("/api/admin/settings", { method: "PATCH", body }),
  audit: (limit = 200) => api<any[]>(`/api/admin/audit?limit=${limit}`),
  retentionPurge: () =>
    api<{
      org_id: string;
      runs_purged: number;
      attachments_purged: number;
      storage_objects_deleted: number;
      cutoff: string;
      completed_at: string;
    }>("/api/admin/retention/purge", { method: "POST" }),
  reviewerQueue: () =>
    api<
      Array<{
        protocol_version_id: string;
        protocol_id: string;
        name: string;
        version_label: string;
        status: string;
        created_at: string | null;
        source_doc_count: number;
        conflicts: number;
        gaps: number;
        synthesis_cards: number;
        missing_coverage: number;
        compile_error: boolean;
      }>
    >("/api/admin/reviewer-queue"),
  webhooks: () =>
    api<{ id: string; target_url: string; event_types: string[]; active: boolean }[]>(
      "/api/admin/webhooks"
    ),
  addWebhook: (target_url: string, event_types: string[]) =>
    api("/api/admin/webhooks", { body: { target_url, event_types } }),
  deleteWebhook: (id: string) => api(`/api/admin/webhooks/${id}`, { method: "DELETE" }),
};

// Sync ----------------------------------------------------------------------

export const sync = {
  push: (events: any[], device_id?: string) =>
    api<{ accepted: number; rejected: number; items: any[] }>("/api/sync/events", {
      body: { events, device_id },
    }),
};

// AI Trace ------------------------------------------------------------------

export type AITraceItem = {
  id: string;
  task_type: string;
  model: string;
  step_id: string | null;
  input_summary: string;
  source_document_ids: string[];
  source_chunk_ids: string[];
  output_schema: string;
  output_json: any;
  citation_count: number;
  citation_coverage: number;
  confidence: string;
  safety_review: any;
  changed_run_state: boolean;
  requires_human_review: boolean;
  latency_ms: number;
  error: string | null;
  created_at: string;
};

export const aiTrace = {
  list: (runId: string, taskType?: string) =>
    api<AITraceItem[]>(
      `/api/runs/${runId}/ai-traces${taskType ? `?task_type=${taskType}` : ""}`
    ),
};

// Escalations ---------------------------------------------------------------

export type Escalation = {
  id: string;
  org_id: string;
  run_id: string | null;
  step_id: string | null;
  kind: string;
  severity: string;
  title: string;
  description: string;
  notify_roles: string[];
  required_action: string;
  resolution_state: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  source_event_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
};

export const escalations = {
  list: (params?: { state?: string; kind?: string; run_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.state) qs.set("state", params.state);
    if (params?.kind) qs.set("kind", params.kind);
    if (params?.run_id) qs.set("run_id", params.run_id);
    const q = qs.toString();
    return api<Escalation[]>(`/api/escalations${q ? `?${q}` : ""}`);
  },
  resolve: (id: string, decision: "resolved" | "dismissed", notes = "") =>
    api<Escalation>(`/api/escalations/${id}/resolve`, { body: { decision, notes } }),
};

// Evaluation harness --------------------------------------------------------

export type EvaluationRun = {
  id: string;
  org_id: string;
  name: string;
  kind: string;
  status: string;
  total_cases: number;
  passed: number;
  failed: number;
  score: number;
  target: number;
  results: any;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export const evaluations = {
  goldenSets: () =>
    api<{
      protocol_packs: any[];
      vision_cases: any[];
      safety_prompts: any[];
      targets: Record<string, number>;
    }>("/api/evaluations/golden-sets"),
  list: (kind?: string) =>
    api<EvaluationRun[]>(`/api/evaluations${kind ? `?kind=${kind}` : ""}`),
  runSafetyRedteam: (protocolVersionId?: string) =>
    api<EvaluationRun>(
      `/api/evaluations/safety-redteam${
        protocolVersionId ? `?protocol_version_id=${protocolVersionId}` : ""
      }`,
      { method: "POST" }
    ),
  runStateBinding: () =>
    api<EvaluationRun>("/api/evaluations/run-state-binding", { method: "POST" }),
  runProtocolExtraction: () =>
    api<EvaluationRun>("/api/evaluations/protocol-extraction", { method: "POST" }),
  runVision: (protocolVersionId?: string) =>
    api<EvaluationRun>(
      `/api/evaluations/vision${
        protocolVersionId ? `?protocol_version_id=${protocolVersionId}` : ""
      }`,
      { method: "POST" }
    ),
};

// Live notifications (SSE) -------------------------------------------------

export const notifications = {
  /**
   * Build the EventSource URL. EventSource cannot send custom headers, so the
   * access token rides on the query string and the active org goes into
   * `org_id`. Caller pattern:
   *   const es = new EventSource(notifications.streamUrl(orgId));
   *   es.addEventListener("escalation_raised", (e) => ...);
   */
  streamUrl: (orgId?: string | null) => {
    if (typeof window === "undefined") return "";
    const tok = window.sessionStorage.getItem("openbench.token") || "";
    const params = new URLSearchParams({ token: tok });
    if (orgId) params.set("org_id", orgId);
    return `${API_BASE}/api/notifications/stream?${params.toString()}`;
  },
};

// Run templates ------------------------------------------------------------

export type RunTemplate = {
  id: string;
  org_id: string;
  protocol_version_id: string;
  name: string;
  description: string | null;
  default_device_id: string | null;
  default_metadata: Record<string, any>;
  created_by: string | null;
  created_at: string;
};

export const runTemplates = {
  list: (protocolVersionId?: string) =>
    api<RunTemplate[]>(
      `/api/run-templates${protocolVersionId ? `?protocol_version_id=${protocolVersionId}` : ""}`
    ),
  get: (id: string) => api<RunTemplate>(`/api/run-templates/${id}`),
  create: (body: {
    protocol_version_id: string;
    name: string;
    description?: string;
    default_device_id?: string;
    default_metadata?: Record<string, any>;
  }) => api<RunTemplate>("/api/run-templates", { body }),
  patch: (id: string, body: Partial<{
    name: string;
    description: string | null;
    default_device_id: string | null;
    default_metadata: Record<string, any>;
  }>) => api<RunTemplate>(`/api/run-templates/${id}`, { method: "PATCH", body }),
  remove: (id: string) =>
    api<{ status: string }>(`/api/run-templates/${id}`, { method: "DELETE" }),
  startRun: (id: string, deviceIdOverride?: string) =>
    api<Run>(
      `/api/run-templates/${id}/start${
        deviceIdOverride ? `?device_id_override=${encodeURIComponent(deviceIdOverride)}` : ""
      }`,
      { method: "POST" }
    ),
};

// Exports / Reports ---------------------------------------------------------

export const exports_ = {
  runsCsvUrl: (statusFilter?: string) =>
    `${API_BASE}/api/exports/runs.csv${statusFilter ? `?status_filter=${statusFilter}` : ""}`,
  deviationsCsvUrl: (state?: string) =>
    `${API_BASE}/api/exports/deviations.csv${state ? `?state=${state}` : ""}`,
  handoversJsonUrl: (statusFilter?: string) =>
    `${API_BASE}/api/exports/handovers.json${statusFilter ? `?status_filter=${statusFilter}` : ""}`,
  protocolsJsonUrl: (statusFilter?: string) =>
    `${API_BASE}/api/exports/protocols.json${statusFilter ? `?status_filter=${statusFilter}` : "?status_filter=published"}`,
};

export { API_BASE };
