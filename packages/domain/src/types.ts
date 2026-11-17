export const EXPERIENCE_BANDS = [
  'student',
  'beginner',
  'junior',
  'intermediate',
  'advanced',
  'prefer_not_to_say',
] as const;
export type ExperienceBand = (typeof EXPERIENCE_BANDS)[number];

export const ACCOUNT_STATUSES = [
  'active',
  'restricted',
  'suspended',
  'pending_deletion',
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const USER_ROLES = [
  'user',
  'host',
  'moderator',
  'content_manager',
  'admin',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROFILE_VISIBILITIES = ['private', 'community'] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];

export const ROOM_TYPES = [
  'discussion',
  'debate',
  'system_design',
  'debug',
  'code_review',
  'incident',
  'teach',
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const SESSION_STATUSES = [
  'draft',
  'open',
  'scheduled',
  'active',
  'paused',
  'completed',
  'cancelled',
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const PARTICIPATION_MODES = ['scheduled', 'async'] as const;
export type ParticipationMode = (typeof PARTICIPATION_MODES)[number];

export const ROOM_MEDIA_MODES = [
  'text_only_mvp',
  'audio_video_planned',
  'audio_video_live',
  'low_bandwidth_audio',
] as const;
export type RoomMediaMode = (typeof ROOM_MEDIA_MODES)[number];

export const DISCUSSION_PHASES = [
  'introduction',
  'preparation',
  'initial_contributions',
  'cross_questioning',
  'open_discussion',
  'conclusion',
  'evaluation_pending',
  'evaluation_complete',
] as const;
export type DiscussionPhase = (typeof DISCUSSION_PHASES)[number];

export const PARTICIPANT_ROLES = ['participant', 'host', 'moderator'] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const PARTICIPANT_STATUSES = ['joined', 'left', 'removed'] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export const MESSAGE_TYPES = ['text', 'code', 'system', 'pass'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const RUBRIC_DIMENSION_KEYS = [
  'technical_accuracy',
  'problem_solving_and_reasoning',
  'critical_thinking_and_tradeoffs',
  'explanation_clarity',
  'question_quality',
  'collaboration_and_adaptability',
] as const;
export type RubricDimensionKey = (typeof RUBRIC_DIMENSION_KEYS)[number];

export const DIMENSION_STATUSES = [
  'scored',
  'insufficient_evidence',
  'not_applicable',
] as const;
export type DimensionStatus = (typeof DIMENSION_STATUSES)[number];

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const EVALUATION_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

export const COMPETENCY_STATUSES = [
  'not_enough_evidence',
  'emerging',
  'developing',
  'consistent',
] as const;
export type CompetencyStatus = (typeof COMPETENCY_STATUSES)[number];

export const REPORT_CATEGORIES = [
  'harassment',
  'spam',
  'off_topic',
  'pii_exposure',
  'malicious_content',
  'other',
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const MODERATION_STATUSES = [
  'open',
  'under_review',
  'resolved',
  'dismissed',
] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const MODERATION_ACTIONS = [
  'no_action',
  'content_removed',
  'warning',
  'temp_suspension',
  'perm_suspension',
  'escalated',
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const LEARNING_FOCUS_AREAS = [
  'technical_depth',
  'explanation_clarity',
  'problem_solving',
  'system_design',
  'debugging',
  'code_review',
  'collaboration',
] as const;
export type LearningFocusArea = (typeof LEARNING_FOCUS_AREAS)[number];

export const AI_ARENA_MODES = [
  'mentor',
  'interviewer',
  'challenger',
  'teach_back',
  'multi_perspective',
] as const;
export type AiArenaMode = (typeof AI_ARENA_MODES)[number];

export const AI_PERSONA_ROLES = [
  'system_architect',
  'security_engineer',
  'performance_engineer',
  'pragmatic_engineer',
  'mentor_coach',
  'mock_interviewer',
] as const;
export type AiPersonaRole = (typeof AI_PERSONA_ROLES)[number];

export const ARCHITECTURE_NODE_KINDS = [
  'client',
  'gateway',
  'service',
  'database',
  'cache',
  'queue',
  'external',
] as const;
export type ArchitectureNodeKind = (typeof ARCHITECTURE_NODE_KINDS)[number];

export interface ArchitectureDiagramNode {
  id: string;
  label: string;
  kind: ArchitectureNodeKind;
  notes: string;
}

export interface ArchitectureDiagramEdge {
  id: string;
  fromId: string;
  toId: string;
  protocol: string;
}

export interface CodeReviewAnnotation {
  id: string;
  authorUid: string;
  authorName: string;
  lineNumber: number;
  severity: 'question' | 'suggestion' | 'risk';
  comment: string;
  createdAtMs: number;
}

export interface EngineeringLabData {
  diagramNodes: ArchitectureDiagramNode[];
  diagramEdges: ArchitectureDiagramEdge[];
  annotations: CodeReviewAnnotation[];
}

export interface UserProfile {
  uid: string;
  displayName: string;
  experienceBand: ExperienceBand;
  accountStatus: AccountStatus;
  onboardingCompleted: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PublicProfile {
  uid: string;
  displayName: string;
  bio: string;
  interests: string[];
  visibility: ProfileVisibility;
  updatedAtMs: number;
}

export interface UserPreferences {
  uid: string;
  goals: LearningFocusArea[];
  interests: string[];
  preferredDifficulty: Difficulty;
  notificationsEnabled: boolean;
  dismissedScenarioIds?: string[];
  updatedAtMs: number;
}

export interface DomainItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  order: number;
  status: 'draft' | 'published' | 'archived';
}

export interface CompetencyItem {
  id: string;
  slug: string;
  domainId: string;
  title: string;
  description: string;
}

export interface ScenarioItem {
  id: string;
  slug: string;
  domainId: string;
  domainTitle: string;
  topicTitle: string;
  title: string;
  roomType: RoomType;
  difficulty: Difficulty;
  estimatedMinutes: number;
  participationMode: 'scheduled' | 'async' | 'both';
  context: string;
  prompt: string;
  constraints: string[];
  learningObjectives: string[];
  prerequisites: string[];
  competencies: string[];
  strongSignals: string[];
  codeArtifact?: string;
  rubricVersion: number;
  status: 'draft' | 'published' | 'archived';
}

export interface RoomCapabilities {
  textEnabled: boolean;
  audioVideoPlanned: boolean;
  sharedWorkspacePlanned: boolean;
  mediaProvider: 'livekit' | null;
  mediaMode: RoomMediaMode;
}

export interface SessionSummary {
  id: string;
  scenarioId: string;
  scenarioSlug: string;
  scenarioTitle: string;
  roomType: RoomType;
  difficulty: Difficulty;
  title: string;
  hostUid: string;
  hostDisplayName: string;
  status: SessionStatus;
  participationMode: ParticipationMode;
  visibility: 'public' | 'private';
  capacity: number;
  participantCount: number;
  participantUids: string[];
  currentPhase: DiscussionPhase;
  phaseVersion: number;
  activeTurnUid: string | null;
  sharedNotes: string;
  roomCapabilities: RoomCapabilities;
  startsAtMs: number | null;
  closesAtMs: number | null;
  completedAtMs: number | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SessionParticipant {
  uid: string;
  sessionId: string;
  displayName: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  micEnabled?: boolean;
  camEnabled?: boolean;
  mediaMode?: 'text' | 'audio' | 'audio_video';
  mediaConsentGranted?: boolean;
  joinedAtMs: number;
  leftAtMs: number | null;
}

export interface SessionWaitlistEntry {
  uid: string;
  sessionId: string;
  displayName: string;
  joinedAtMs: number;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  senderUid: string;
  senderDisplayName: string;
  body: string;
  messageType: MessageType;
  phase: DiscussionPhase;
  replyToMessageId: string | null;
  clientMessageId: string;
  createdAtMs: number;
  editedAtMs: number | null;
  deletedAtMs: number | null;
}

export interface SessionEvent {
  id: string;
  sessionId: string;
  actorUid: string;
  eventType:
    | 'session_created'
    | 'participant_joined'
    | 'participant_left'
    | 'participant_removed'
    | 'session_started'
    | 'session_paused'
    | 'session_resumed'
    | 'phase_changed'
    | 'turn_passed'
    | 'session_completed'
    | 'session_cancelled'
    | 'evaluation_requested'
    | 'evaluation_completed'
    | 'media_mode_changed'
    | 'waitlist_joined';
  summary: string;
  createdAtMs: number;
}

export interface EvaluationEvidenceItem {
  message_id: string;
  excerpt: string;
  type: 'strength' | 'improvement';
  explanation: string;
}

export interface EvaluationDimensionResult {
  key: RubricDimensionKey;
  status: DimensionStatus;
  rating: number | null;
  summary: string;
  confidence: ConfidenceLevel;
  evidence: EvaluationEvidenceItem[];
}

export interface EvaluationImprovementItem {
  action: string;
  why_it_matters: string;
  evidence_message_ids: string[];
}

export interface EvaluationNextPractice {
  competency_key: string;
  suggested_activity_type: string;
  reason: string;
}

export interface EvaluationReportPayload {
  summary: string;
  confidence: ConfidenceLevel;
  dimensions: EvaluationDimensionResult[];
  strengths: string[];
  improvements: EvaluationImprovementItem[];
  next_practice: EvaluationNextPractice;
}

export interface UserEvaluationRecord {
  id: string;
  uid: string;
  sessionId: string;
  scenarioId: string;
  scenarioTitle: string;
  rubricVersion: number;
  promptVersion: string;
  provider: string;
  model: string;
  status: EvaluationStatus;
  report: EvaluationReportPayload | null;
  errorCode: string | null;
  feedbackUseful: 'useful' | 'mixed' | 'not_useful' | null;
  flaggedForReview: boolean;
  flagReason: string | null;
  createdAtMs: number;
  completedAtMs: number | null;
}

export interface CompetencyObservation {
  id: string;
  uid: string;
  competencyKey: string;
  sessionId: string;
  evaluationId: string;
  rating: number;
  confidence: ConfidenceLevel;
  rubricVersion: number;
  observedAtMs: number;
}

export interface UserReportCase {
  id: string;
  reporterUid: string;
  targetUid: string;
  sessionId: string;
  messageId: string | null;
  category: ReportCategory;
  details: string;
  status: ModerationStatus;
  resolutionAction: ModerationAction | null;
  resolutionNotes: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface AuditEventRecord {
  id: string;
  actorUid: string;
  action: string;
  targetType: string;
  targetId: string;
  outcome: 'allowed' | 'denied' | 'succeeded' | 'failed';
  createdAtMs: number;
}

export interface ArenaSessionSummary {
  id: string;
  uid: string;
  scenarioId: string;
  scenarioSlug: string;
  scenarioTitle: string;
  mode: AiArenaMode;
  activePersonas: AiPersonaRole[];
  status: 'active' | 'completed';
  turnCount: number;
  coachingNotes: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ArenaMessage {
  id: string;
  arenaId: string;
  uid: string;
  senderType: 'learner' | 'ai';
  senderDisplayName: string;
  personaRole: AiPersonaRole | null;
  body: string;
  coachingHint: string | null;
  createdAtMs: number;
}

export interface SkillPassportCompetencyItem {
  competencyKey: string;
  title: string;
  status: CompetencyStatus;
  confidence: ConfidenceLevel;
  observationCount: number;
}

export interface SkillPassportRecord {
  uid: string;
  displayName: string;
  headline: string;
  bio: string;
  experienceBand: ExperienceBand;
  visibility: ProfileVisibility;
  completedSessionsCount: number;
  verifiedCompetencies: SkillPassportCompetencyItem[];
  updatedAtMs: number;
}

