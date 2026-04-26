import { z } from "zod";

export const Citation = z.object({
  document_id: z.string(),
  page_no: z.number().int().nullable().optional(),
  section_label: z.string().nullable().optional(),
  chunk_id: z.string().nullable().optional(),
  quote_summary: z.string().optional(),
});
export type Citation = z.infer<typeof Citation>;

export const VisualCheck = z.object({
  check_id: z.string(),
  claim: z.string(),
  required: z.boolean().default(true),
  rationale: z.string().nullable().optional(),
});
export type VisualCheck = z.infer<typeof VisualCheck>;

export const TimerSpec = z.object({
  label: z.string(),
  duration_seconds: z.number().int(),
  auto_start: z.boolean().default(false),
});
export type TimerSpec = z.infer<typeof TimerSpec>;

export const StepDataField = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(["text", "number", "boolean", "choice"]).default("text"),
  units: z.string().nullable().optional(),
  options: z.array(z.string()).nullable().optional(),
  required: z.boolean().default(false),
});
export type StepDataField = z.infer<typeof StepDataField>;

export const ProtocolStep = z.object({
  id: z.string(),
  step_key: z.string(),
  order_index: z.number().int(),
  title: z.string(),
  instruction: z.string().default(""),
  is_skippable: z.boolean().default(false),
  prerequisites_json: z.array(z.string()).default([]),
  required_ppe_json: z.array(z.string()).default([]),
  controls_json: z.array(z.string()).default([]),
  materials_json: z.array(z.string()).default([]),
  equipment_json: z.array(z.string()).default([]),
  timers_json: z.array(TimerSpec).default([]),
  visual_checks_json: z.array(VisualCheck).default([]),
  stop_conditions_json: z.array(z.string()).default([]),
  expected_observations_json: z.array(z.string()).default([]),
  data_capture_schema_json: z.array(StepDataField).default([]),
  source_refs_json: z.array(Citation).default([]),
  confidence_score: z.number().default(0),
  reviewer_notes: z.string().nullable().optional(),
});
export type ProtocolStep = z.infer<typeof ProtocolStep>;

export const HazardRule = z.object({
  id: z.string(),
  step_id: z.string().nullable().optional(),
  category: z.string(),
  requirement_text: z.string(),
  severity: z.string(),
  source_refs_json: z.array(Citation).default([]),
});
export type HazardRule = z.infer<typeof HazardRule>;

export const ProtocolVersion = z.object({
  id: z.string(),
  protocol_id: z.string(),
  version_label: z.string(),
  status: z.enum(["draft", "in_review", "published", "archived"]),
  source_doc_ids: z.array(z.string()).default([]),
  summary: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  published_by: z.string().nullable().optional(),
  supersedes_version_id: z.string().nullable().optional(),
});
export type ProtocolVersion = z.infer<typeof ProtocolVersion>;

export const ProtocolVersionDetail = ProtocolVersion.extend({
  name: z.string(),
  steps: z.array(ProtocolStep).default([]),
  hazard_rules: z.array(HazardRule).default([]),
  compiler_metadata: z.record(z.any()).default({}),
});
export type ProtocolVersionDetail = z.infer<typeof ProtocolVersionDetail>;

export const Protocol = z.object({
  id: z.string(),
  org_id: z.string(),
  name: z.string(),
  status: z.string(),
  versions: z.array(ProtocolVersion).default([]),
});
export type Protocol = z.infer<typeof Protocol>;

export const Run = z.object({
  id: z.string(),
  org_id: z.string(),
  protocol_version_id: z.string(),
  operator_id: z.string(),
  status: z.enum([
    "created",
    "preflight",
    "active",
    "paused",
    "blocked",
    "awaiting_override",
    "completed",
    "cancelled",
    "closed",
  ]),
  current_step_id: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  ended_at: z.string().nullable().optional(),
  device_id: z.string().nullable().optional(),
  block_reason: z.string().nullable().optional(),
});
export type Run = z.infer<typeof Run>;

export const StepState = z.object({
  id: z.string(),
  run_id: z.string(),
  step_id: z.string(),
  status: z.enum([
    "not_started",
    "in_progress",
    "waiting_on_timer",
    "waiting_on_checkpoint",
    "blocked",
    "completed",
    "skipped",
  ]),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  blocked_reason_json: z.record(z.any()).nullable().optional(),
  confirmations_json: z.record(z.any()).default({}),
  measurements_json: z.record(z.any()).default({}),
});
export type StepState = z.infer<typeof StepState>;

export const RunEvent = z.object({
  id: z.string(),
  run_id: z.string(),
  event_type: z.string(),
  step_id: z.string().nullable().optional(),
  actor_id: z.string().nullable().optional(),
  payload_json: z.record(z.any()).default({}),
  server_timestamp: z.string(),
});
export type RunEvent = z.infer<typeof RunEvent>;

export const Timer = z.object({
  id: z.string(),
  run_id: z.string(),
  step_id: z.string().nullable().optional(),
  label: z.string(),
  duration_seconds: z.number(),
  started_at: z.string().nullable().optional(),
  ended_at: z.string().nullable().optional(),
  status: z.string(),
});
export type Timer = z.infer<typeof Timer>;

export const Deviation = z.object({
  id: z.string(),
  run_id: z.string(),
  step_id: z.string().nullable().optional(),
  severity: z.string(),
  title: z.string(),
  description: z.string().default(""),
  resolution_state: z.string(),
  requires_review: z.boolean(),
  attachments_json: z.array(z.string()).default([]),
  created_at: z.string(),
});
export type Deviation = z.infer<typeof Deviation>;

export const Attachment = z.object({
  id: z.string(),
  run_id: z.string().nullable().optional(),
  step_id: z.string().nullable().optional(),
  kind: z.string(),
  storage_path: z.string(),
  mime_type: z.string(),
  created_at: z.string(),
});
export type Attachment = z.infer<typeof Attachment>;

export const PhotoAssessmentItem = z.object({
  check_id: z.string(),
  status: z.enum(["confirmed", "not_visible", "unclear", "cannot_verify"]),
  evidence: z.string().default(""),
  confidence: z.string().default("medium"),
});
export type PhotoAssessmentItem = z.infer<typeof PhotoAssessmentItem>;

export const PhotoAssessment = z.object({
  id: z.string(),
  run_id: z.string(),
  step_id: z.string(),
  attachment_id: z.string(),
  overall_status: z.enum(["ok", "attention_required", "stop", "pending"]),
  items: z.array(PhotoAssessmentItem),
  recommended_action: z.string().default(""),
  model_metadata: z.record(z.any()).default({}),
});
export type PhotoAssessment = z.infer<typeof PhotoAssessment>;

export const RunDetail = z.object({
  run: Run,
  protocol_version_id: z.string(),
  step_states: z.array(StepState).default([]),
  timers: z.array(Timer).default([]),
  deviations: z.array(Deviation).default([]),
  attachments: z.array(Attachment).default([]),
  events: z.array(RunEvent).default([]),
  photo_assessments: z.array(z.any()).default([]),
});
export type RunDetail = z.infer<typeof RunDetail>;

export const HandoverReport = z.object({
  id: z.string(),
  run_id: z.string(),
  status: z.string(),
  report_json: z.record(z.any()),
  markdown_body: z.string(),
  html_body: z.string(),
  pdf_url: z.string().nullable().optional(),
  generated_at: z.string().nullable().optional(),
  finalized_at: z.string().nullable().optional(),
});
export type HandoverReport = z.infer<typeof HandoverReport>;

export const Document = z.object({
  id: z.string(),
  org_id: z.string(),
  document_type: z.string(),
  title: z.string(),
  declared_version: z.string().nullable().optional(),
  storage_path: z.string(),
  mime_type: z.string(),
  page_count: z.number().int(),
  parse_status: z.string(),
});
export type Document = z.infer<typeof Document>;

export const DocumentDetail = Document.extend({
  extracted_text_preview: z.string().default(""),
  chunk_count: z.number().int().default(0),
});
export type DocumentDetail = z.infer<typeof DocumentDetail>;

export const Membership = z.object({
  id: z.string(),
  org_id: z.string(),
  org_name: z.string(),
  org_slug: z.string(),
  role: z.string(),
});
export type Membership = z.infer<typeof Membership>;

export const Me = z.object({
  id: z.string(),
  email: z.string(),
  display_name: z.string(),
  memberships: z.array(Membership),
});
export type Me = z.infer<typeof Me>;

export const TokenPair = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string().default("bearer"),
  expires_in_min: z.number().int(),
});
export type TokenPair = z.infer<typeof TokenPair>;

export const RoleRank: Record<string, number> = {
  operator: 0,
  reviewer: 2,
  manager: 3,
  safety_lead: 3,
  admin: 4,
};

export const SUPPORTED_DOCUMENT_TYPES = ["sop", "sds", "manual", "policy", "unknown"] as const;
export type DocumentType = (typeof SUPPORTED_DOCUMENT_TYPES)[number];
