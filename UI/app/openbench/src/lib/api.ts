// Typed API client for the OpenBench backend.
// Handles JWT bearer auth, X-Org-Id header, and one-shot 401 refresh.
// Token storage lives in localStorage so EventSource (SSE) can reuse the same token.

export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  'http://localhost:8000';

const ACCESS_KEY = 'openbench_access_token';
const REFRESH_KEY = 'openbench_refresh_token';
const ORG_KEY = 'openbench_org_id';
const USER_KEY = 'openbench_user';

export interface StoredUser {
  id: string;
  email: string;
  display_name: string;
  org_id: string;
  org_name: string;
  org_slug: string;
  role: string;
  initials: string;
}

function isBrowser() {
  return typeof window !== 'undefined';
}

export const tokenStore = {
  getAccess(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  getRefresh(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  getOrgId(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(ORG_KEY);
  },
  getUser(): StoredUser | null {
    if (!isBrowser()) return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      return null;
    }
  },
  setTokens(access: string, refresh: string) {
    if (!isBrowser()) return;
    window.localStorage.setItem(ACCESS_KEY, access);
    window.localStorage.setItem(REFRESH_KEY, refresh);
  },
  setUser(user: StoredUser) {
    if (!isBrowser()) return;
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.localStorage.setItem(ORG_KEY, user.org_id);
  },
  clear() {
    if (!isBrowser()) return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem(ORG_KEY);
    window.localStorage.removeItem(USER_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  // Skip the auth header (used for /auth/login and /auth/refresh).
  unauthenticated?: boolean;
  // Skip the X-Org-Id header (used before org is known, e.g. /auth/me).
  noOrg?: boolean;
  signal?: AbortSignal;
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access_token: string; refresh_token: string };
    tokenStore.setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function rawRequest(path: string, opts: RequestOptions): Promise<Response> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE_URL}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!opts.unauthenticated) {
    const access = tokenStore.getAccess();
    if (access) headers['Authorization'] = `Bearer ${access}`;
  }
  if (!opts.noOrg) {
    const orgId = tokenStore.getOrgId();
    if (orgId) headers['X-Org-Id'] = orgId;
  }
  const init: RequestInit = {
    method: opts.method || 'GET',
    headers,
    signal: opts.signal,
  };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
  }
  return fetch(url.toString(), init);
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await rawRequest(path, opts);

  if (res.status === 401 && !opts.unauthenticated) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await rawRequest(path, opts);
    } else {
      tokenStore.clear();
      if (isBrowser() && !window.location.pathname.startsWith('/sign-up-login')) {
        window.location.replace('/sign-up-login');
      }
    }
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      try {
        body = await res.text();
      } catch {
        // ignore
      }
    }
    const message =
      (body && typeof body === 'object' && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : null) || `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message, body);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }
  const ct = res.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

// Multipart upload helper. Used for documents and run attachments.
export async function uploadMultipart<T>(
  path: string,
  fields: Record<string, string | Blob | undefined | null>,
  opts: { signal?: AbortSignal } = {}
): Promise<T> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    fd.set(k, v as string | Blob);
  }
  const headers: Record<string, string> = {};
  const access = tokenStore.getAccess();
  if (access) headers['Authorization'] = `Bearer ${access}`;
  const orgId = tokenStore.getOrgId();
  if (orgId) headers['X-Org-Id'] = orgId;
  let res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: fd,
    signal: opts.signal,
  });
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const access2 = tokenStore.getAccess();
      if (access2) headers['Authorization'] = `Bearer ${access2}`;
      res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body: fd,
        signal: opts.signal,
      });
    } else {
      tokenStore.clear();
      if (isBrowser() && !window.location.pathname.startsWith('/sign-up-login')) {
        window.location.replace('/sign-up-login');
      }
    }
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      try {
        body = await res.text();
      } catch {
        /* */
      }
    }
    const message =
      (body && typeof body === 'object' && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : null) || `Upload failed (${res.status})`;
    throw new ApiError(res.status, message, body);
  }
  return (await res.json()) as T;
}

// --- Domain types -----------------------------------------------------------

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in_min: number;
}

export interface MembershipOut {
  id: string;
  org_id: string;
  org_name: string;
  org_slug: string;
  role: string;
}

export interface MeResponse {
  id: string;
  email: string;
  display_name: string;
  memberships: MembershipOut[];
}

export interface DashboardStats {
  active_runs: number;
  blocked_runs: number;
  pending_handovers: number;
  completed_runs_7d: number;
  deviations_open: number;
  drafts_in_review: number;
}

export interface RecentRun {
  id: string;
  status: string;
  operator_id: string;
  protocol_version_id: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface RunOut {
  id: string;
  org_id: string;
  protocol_version_id: string;
  operator_id: string;
  status: string;
  current_step_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  device_id?: string | null;
  block_reason?: string | null;
  created_at?: string | null;
}

export interface DeviationOut {
  id: string;
  run_id: string;
  step_id?: string | null;
  severity: string;
  title: string;
  description?: string | null;
  resolution_state: string;
  requires_review: boolean;
  attachments_json?: unknown;
  created_at: string;
}

export interface StepStateOut {
  id: string;
  run_id: string;
  step_id: string;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  blocked_reason_json?: Record<string, unknown> | null;
  confirmations_json?: Record<string, unknown>;
  measurements_json?: Record<string, unknown>;
}

export interface RunEventOut {
  id: string;
  run_id: string;
  event_type: string;
  step_id?: string | null;
  actor_id?: string | null;
  payload_json?: Record<string, unknown> | null;
  server_timestamp: string;
}

export interface TimerOut {
  id: string;
  run_id: string;
  step_id?: string | null;
  label: string;
  duration_seconds: number;
  started_at?: string | null;
  ended_at?: string | null;
  status: string;
}

export interface RunDetail {
  run: RunOut;
  step_states: StepStateOut[];
  timers: TimerOut[];
  deviations: DeviationOut[];
  attachments: AttachmentOut[];
  events: RunEventOut[];
  photo_assessments: PhotoAssessmentOut[];
}

export interface ProtocolOut {
  id: string;
  org_id: string;
  name: string;
  status?: string;
  versions?: ProtocolVersionOut[];
  created_by?: string | null;
  created_at?: string | null;
}

export interface ProtocolVersionOut {
  id: string;
  protocol_id: string;
  version_label: string;
  status: string;
  source_doc_ids?: string[] | null;
  summary?: string | null;
  published_at?: string | null;
  published_by?: string | null;
  supersedes_version_id?: string | null;
  created_at?: string | null;
}

export interface MemberOut {
  membership_id: string;
  user: {
    id: string;
    email: string;
    display_name: string;
    status: string;
  };
  role: string;
  team_id?: string | null;
}

export interface OrgSettingsOut {
  org_id: string;
  name: string;
  slug: string;
  data_region?: string | null;
  retention_policy_days?: number | null;
}

export interface AuditLogOut {
  id: string;
  actor_id?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  summary?: string | null;
  metadata_json?: Record<string, unknown> | null;
  created_at: string;
}

export interface ApiKeyStatus {
  has_key: boolean;
  masked?: string | null;
  source: 'org' | 'env' | 'none';
  updated_at?: string | null;
}

export interface ApiKeyTestResponse {
  ok: boolean;
  detail?: string | null;
  model?: string | null;
}

export interface DocumentOut {
  id: string;
  org_id: string;
  document_type: string;
  title: string;
  declared_version?: string | null;
  storage_path: string;
  mime_type: string;
  page_count: number;
  parse_status: string;
  parse_metadata?: Record<string, unknown>;
}

export interface DocumentDetail extends DocumentOut {
  extracted_text_preview?: string;
  chunk_count?: number;
}

export interface CitationRef {
  document_id: string;
  page_no?: number | null;
  section_label?: string | null;
  chunk_id?: string | null;
  quote_summary?: string | null;
}

export interface TimerSpec {
  label: string;
  duration_seconds: number;
}

export interface VisualCheck {
  description: string;
  expected_observation?: string;
  failure_action?: string;
}

export interface StepDataField {
  key: string;
  label?: string;
  unit?: string;
  type?: string;
  required?: boolean;
}

export interface ProtocolStepOut {
  id: string;
  step_key: string;
  order_index: number;
  title: string;
  instruction: string;
  is_skippable: boolean;
  prerequisites_json: string[];
  required_ppe_json: string[];
  controls_json: string[];
  materials_json: string[];
  equipment_json: string[];
  timers_json: TimerSpec[];
  visual_checks_json: VisualCheck[];
  stop_conditions_json: string[];
  expected_observations_json: string[];
  data_capture_schema_json: StepDataField[];
  source_refs_json: CitationRef[];
  confidence_score: number;
  reviewer_notes?: string | null;
}

export interface HazardRuleOut {
  id: string;
  step_id?: string | null;
  category: string;
  requirement_text: string;
  severity: string;
  source_refs_json: CitationRef[];
}

export interface ProtocolVersionDetail extends ProtocolVersionOut {
  name: string;
  steps: ProtocolStepOut[];
  hazard_rules: HazardRuleOut[];
  compiler_metadata: Record<string, unknown>;
}

export interface PublishResponse {
  protocol_version_id: string;
  version_label: string;
  status: string;
}

export interface AttachmentOut {
  id: string;
  run_id?: string | null;
  step_id?: string | null;
  kind: string;
  storage_path: string;
  mime_type: string;
  created_at: string;
}

export interface PhotoAssessmentOut {
  id: string;
  run_id: string;
  step_id?: string | null;
  attachment_id?: string | null;
  result: string;
  confidence?: number | null;
  notes?: string | null;
  rationale?: string | null;
  created_at: string;
}

export interface AskCitation {
  document_id: string;
  page_no?: number | null;
  section_label?: string | null;
  chunk_id?: string | null;
  quote_summary?: string | null;
}

export interface AskResponse {
  answer_text: string;
  citations: AskCitation[];
  confidence: string;
}

export interface NotificationsListItem {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  read: boolean;
}

// --- Endpoint helpers -------------------------------------------------------

export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiRequest<TokenPair>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      unauthenticated: true,
      noOrg: true,
    }),
  register: (payload: {
    email: string;
    password: string;
    display_name: string;
    org_name: string;
    org_slug?: string;
  }) =>
    apiRequest<TokenPair>('/api/auth/register', {
      method: 'POST',
      body: payload,
      unauthenticated: true,
      noOrg: true,
    }),
  me: () => apiRequest<MeResponse>('/api/auth/me', { noOrg: true }),
  logout: (refresh_token?: string) =>
    apiRequest<{ status: string }>('/api/auth/logout', {
      method: 'POST',
      body: refresh_token ? { refresh_token } : undefined,
      unauthenticated: true,
      noOrg: true,
    }),

  // Dashboard
  dashboardStats: () => apiRequest<DashboardStats>('/api/dashboard'),
  dashboardRecentRuns: (limit = 12) =>
    apiRequest<RecentRun[]>('/api/dashboard/recent-runs', { query: { limit } }),

  // Runs
  listRuns: (statusFilter?: string) =>
    apiRequest<RunOut[]>('/api/runs', { query: { status_filter: statusFilter } }),
  getRun: (runId: string) => apiRequest<RunDetail>(`/api/runs/${runId}`),
  createRun: (payload: { protocol_version_id: string; device_id?: string }) =>
    apiRequest<RunOut>('/api/runs', { method: 'POST', body: payload }),
  preflightRun: (runId: string) =>
    apiRequest<RunDetail>(`/api/runs/${runId}/preflight`, { method: 'POST' }),
  startRun: (runId: string) => apiRequest<RunOut>(`/api/runs/${runId}/start`, { method: 'POST' }),
  pauseRun: (runId: string) => apiRequest<RunOut>(`/api/runs/${runId}/pause`, { method: 'POST' }),
  resumeRun: (runId: string) => apiRequest<RunOut>(`/api/runs/${runId}/resume`, { method: 'POST' }),
  cancelRun: (runId: string) => apiRequest<RunOut>(`/api/runs/${runId}/cancel`, { method: 'POST' }),

  // Deviations
  listDeviations: (state?: string) =>
    apiRequest<DeviationOut[]>('/api/deviations', { query: { state } }),
  resolveDeviation: (id: string, payload: { resolution_state: string; note?: string }) =>
    apiRequest<DeviationOut>(`/api/deviations/${id}/resolve`, { method: 'POST', body: payload }),

  // Protocols
  listProtocols: () => apiRequest<ProtocolOut[]>('/api/protocols'),
  listProtocolVersions: (status?: string) =>
    apiRequest<ProtocolVersionOut[]>('/api/protocol-versions', { query: { status } }),
  getProtocolVersion: (versionId: string) =>
    apiRequest<ProtocolVersionDetail>(`/api/protocol-versions/${versionId}`),
  getProtocolDraft: (versionId: string) =>
    apiRequest<ProtocolVersionDetail>(`/api/protocol-drafts/${versionId}`),
  publishProtocolDraft: (versionId: string) =>
    apiRequest<PublishResponse>(`/api/protocol-drafts/${versionId}/publish`, { method: 'POST' }),
  archiveProtocolVersion: (versionId: string) =>
    apiRequest<ProtocolVersionOut>(`/api/protocol-versions/${versionId}/archive`, {
      method: 'POST',
    }),
  compileProtocolDraft: (payload: { document_ids: string[]; name?: string }) =>
    apiRequest<ProtocolVersionDetail>('/api/protocol-drafts/compile', {
      method: 'POST',
      body: payload,
    }),
  patchProtocolDraft: (
    versionId: string,
    payload: {
      name?: string;
      summary?: string;
      patch_step_id?: string;
      patch_step?: Partial<ProtocolStepOut>;
      remove_step_id?: string;
    }
  ) =>
    apiRequest<ProtocolVersionDetail>(`/api/protocol-drafts/${versionId}`, {
      method: 'PATCH',
      body: payload,
    }),

  // Documents
  listDocuments: () => apiRequest<DocumentOut[]>('/api/documents'),
  getDocument: (id: string) => apiRequest<DocumentDetail>(`/api/documents/${id}`),
  deleteDocument: (id: string) =>
    apiRequest<{ status: string }>(`/api/documents/${id}`, { method: 'DELETE' }),
  uploadDocument: (file: File, suggestedType?: string, declaredVersion?: string) =>
    uploadMultipart<DocumentDetail>('/api/documents/upload-direct', {
      file,
      suggested_type: suggestedType,
      declared_version: declaredVersion,
    }),
  documentDownloadUrl: (id: string) =>
    apiRequest<{ url: string }>(`/api/documents/${id}/download-url`),

  // Run actions (operator)
  startStep: (runId: string, stepId: string, key?: string) =>
    apiRequest<RunDetail>(`/api/runs/${runId}/steps/${stepId}/start`, {
      method: 'POST',
      body: { idempotency_key: key },
    }),
  completeStep: (
    runId: string,
    stepId: string,
    payload: {
      idempotency_key?: string;
      confirmations?: Record<string, unknown>;
      measurements?: Record<string, unknown>;
      override_block?: boolean;
      override_reason?: string;
    } = {}
  ) =>
    apiRequest<RunDetail>(`/api/runs/${runId}/steps/${stepId}/complete`, {
      method: 'POST',
      body: payload,
    }),
  skipStep: (runId: string, stepId: string, reason: string, key?: string) =>
    apiRequest<RunDetail>(`/api/runs/${runId}/steps/${stepId}/skip`, {
      method: 'POST',
      body: { reason, idempotency_key: key },
    }),
  addNote: (
    runId: string,
    payload: { text: string; step_id?: string | null; idempotency_key?: string }
  ) => apiRequest<RunEventOut>(`/api/runs/${runId}/notes`, { method: 'POST', body: payload }),
  addMeasurement: (
    runId: string,
    payload: {
      step_id: string;
      key: string;
      value: number | string;
      units?: string;
      idempotency_key?: string;
    }
  ) =>
    apiRequest<RunEventOut>(`/api/runs/${runId}/measurements`, { method: 'POST', body: payload }),
  addDeviation: (
    runId: string,
    payload: {
      title: string;
      severity?: string;
      description?: string;
      step_id?: string | null;
      requires_review?: boolean;
      idempotency_key?: string;
    }
  ) => apiRequest<DeviationOut>(`/api/runs/${runId}/deviations`, { method: 'POST', body: payload }),
  startTimer: (
    runId: string,
    payload: { label: string; duration_seconds: number; step_id?: string | null }
  ) => apiRequest<TimerOut>(`/api/runs/${runId}/timers`, { method: 'POST', body: payload }),
  requestOverride: (
    runId: string,
    payload: { step_id: string; category: string; reason: string }
  ) =>
    apiRequest<RunEventOut>(`/api/runs/${runId}/override-requests`, {
      method: 'POST',
      body: payload,
    }),

  // Run attachments + AI
  uploadAttachment: (runId: string, file: File, kind = 'photo', stepId?: string) =>
    uploadMultipart<AttachmentOut>(`/api/runs/${runId}/attachments`, {
      file,
      kind,
      step_id: stepId,
    }),
  attachmentDownloadUrl: (id: string) =>
    apiRequest<{ url: string }>(`/api/attachments/${id}/download-url`),
  askAI: (runId: string, payload: { question: string; step_id?: string; context_mode?: string }) =>
    apiRequest<AskResponse>(`/api/runs/${runId}/ask`, { method: 'POST', body: payload }),
  photoCheck: (
    runId: string,
    stepId: string,
    payload: { attachment_id: string; instruction?: string }
  ) =>
    apiRequest<PhotoAssessmentOut>(`/api/runs/${runId}/steps/${stepId}/photo-check`, {
      method: 'POST',
      body: payload,
    }),

  // Handover
  handoverGenerate: (runId: string) =>
    apiRequest<Record<string, unknown>>(`/api/runs/${runId}/handover/generate`, { method: 'POST' }),
  handoverGet: (runId: string) =>
    apiRequest<Record<string, unknown>>(`/api/runs/${runId}/handover`),
  handoverFinalize: (runId: string) =>
    apiRequest<Record<string, unknown>>(`/api/runs/${runId}/handover/finalize`, { method: 'POST' }),

  // Admin
  listMembers: () => apiRequest<MemberOut[]>('/api/admin/users'),
  inviteUser: (payload: {
    email: string;
    display_name: string;
    role: string;
    initial_password: string;
  }) => apiRequest<MemberOut>('/api/admin/users/invite', { method: 'POST', body: payload }),
  updateMembership: (membershipId: string, role: string) =>
    apiRequest<MemberOut>(`/api/admin/memberships/${membershipId}`, {
      method: 'PATCH',
      body: { role },
    }),
  getOrgSettings: () => apiRequest<OrgSettingsOut>('/api/admin/settings'),
  updateOrgSettings: (payload: {
    name?: string;
    data_region?: string;
    retention_policy_days?: number;
  }) => apiRequest<OrgSettingsOut>('/api/admin/settings', { method: 'PATCH', body: payload }),
  listAuditLog: (limit = 200) =>
    apiRequest<AuditLogOut[]>('/api/admin/audit', { query: { limit } }),
  getApiKeyStatus: () => apiRequest<ApiKeyStatus>('/api/admin/api-keys'),
  updateApiKey: (apiKey: string | null) =>
    apiRequest<ApiKeyStatus>('/api/admin/api-keys', {
      method: 'PATCH',
      body: { api_key: apiKey },
    }),
  testApiKey: () => apiRequest<ApiKeyTestResponse>('/api/admin/api-keys/test', { method: 'POST' }),
};
