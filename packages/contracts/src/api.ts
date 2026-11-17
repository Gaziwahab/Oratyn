import type {
  AiPersonaRole,
  EvaluationReportPayload,
} from '../../domain/src/types';

export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SESSION_FULL'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_AI_OUTPUT'
  | 'INTERNAL_ERROR';

export interface ApiMeta {
  requestId: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
  };
  meta: ApiMeta;
}

export interface GenerateEvaluationResponseData {
  provider: string;
  model: string;
  promptVersion: string;
  rubricVersion: number;
  report: EvaluationReportPayload;
  evidenceRejectedCount: number;
}

export interface ArenaTurnReplyItem {
  personaRole: AiPersonaRole;
  senderDisplayName: string;
  badge: string;
  body: string;
  coachingHint: string;
}

export interface ArenaTurnResponseData {
  provider: string;
  model: string;
  replies: ArenaTurnReplyItem[];
}

export interface MediaTokenResponseData {
  sessionId: string;
  provider: 'livekit' | 'webrtc_local_stage';
  wsUrl: string | null;
  token: string;
  expiresAtMs: number;
  mediaMode: 'audio' | 'audio_video';
}

