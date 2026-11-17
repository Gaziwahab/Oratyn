import { z } from 'zod';
import {
  AI_ARENA_MODES,
  AI_PERSONA_ROLES,
  DIFFICULTIES,
  EXPERIENCE_BANDS,
  LEARNING_FOCUS_AREAS,
  MESSAGE_TYPES,
  MODERATION_ACTIONS,
  PARTICIPATION_MODES,
  PROFILE_VISIBILITIES,
  REPORT_CATEGORIES,
  ROOM_TYPES,
} from '../../domain/src/types';
import {
  MAX_MESSAGE_LENGTH,
  MAX_ROOM_CAPACITY,
  MAX_SHARED_NOTES_LENGTH,
  MIN_ROOM_CAPACITY,
} from '../../domain/src/discussion';

export const ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export const SafeIdSchema = z
  .string()
  .trim()
  .regex(ID_PATTERN, 'Invalid resource identifier format.');

export const OnboardingProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Display name must be at least 2 characters.')
      .max(60, 'Display name must be 60 characters or fewer.'),
    experienceBand: z.enum(EXPERIENCE_BANDS),
    goals: z
      .array(z.enum(LEARNING_FOCUS_AREAS))
      .min(1, 'Select at least one learning focus.')
      .max(7),
    interests: z
      .array(z.string().trim().min(1).max(40))
      .min(1, 'Select at least one topic interest.')
      .max(10),
    preferredDifficulty: z.enum(DIFFICULTIES),
    notificationsEnabled: z.boolean(),
  })
  .strict();

export const UpdatePublicProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(60),
    bio: z.string().trim().max(280),
    interests: z.array(z.string().trim().min(1).max(40)).max(10),
    visibility: z.enum(PROFILE_VISIBILITIES),
  })
  .strict();

export const CreateSessionSchema = z
  .object({
    scenarioId: SafeIdSchema,
    title: z.string().trim().min(4).max(120),
    roomType: z.enum(ROOM_TYPES),
    participationMode: z.enum(PARTICIPATION_MODES),
    visibility: z.enum(['public', 'private']),
    capacity: z.number().int().min(MIN_ROOM_CAPACITY).max(MAX_ROOM_CAPACITY),
    startsAtMs: z.number().int().nullable(),
  })
  .strict();

export const SendMessageSchema = z
  .object({
    sessionId: SafeIdSchema,
    body: z
      .string()
      .trim()
      .min(1, 'Message cannot be empty.')
      .max(MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`),
    messageType: z.enum(MESSAGE_TYPES),
    replyToMessageId: SafeIdSchema.nullable(),
    clientMessageId: SafeIdSchema,
  })
  .strict();

export const UpdateSharedNotesSchema = z
  .object({
    sessionId: SafeIdSchema,
    sharedNotes: z.string().max(MAX_SHARED_NOTES_LENGTH),
  })
  .strict();

export const CreateReportSchema = z
  .object({
    targetUid: SafeIdSchema,
    sessionId: SafeIdSchema,
    messageId: SafeIdSchema.nullable(),
    category: z.enum(REPORT_CATEGORIES),
    details: z.string().trim().min(5).max(1000),
  })
  .strict();

export const ResolveReportSchema = z
  .object({
    reportId: SafeIdSchema,
    status: z.enum(['under_review', 'resolved', 'dismissed']),
    resolutionAction: z.enum(MODERATION_ACTIONS),
    resolutionNotes: z.string().trim().min(3).max(1000),
  })
  .strict();

export const EvaluationOutputSchema = z
  .object({
    summary: z.string().trim().min(10).max(1200),
    confidence: z.enum(['low', 'medium', 'high']),
    dimensions: z
      .array(
        z
          .object({
            key: z.enum([
              'technical_accuracy',
              'problem_solving_and_reasoning',
              'critical_thinking_and_tradeoffs',
              'explanation_clarity',
              'question_quality',
              'collaboration_and_adaptability',
            ]),
            status: z.enum(['scored', 'insufficient_evidence', 'not_applicable']),
            rating: z.number().int().min(0).max(4).nullable(),
            summary: z.string().trim().min(5).max(600),
            confidence: z.enum(['low', 'medium', 'high']),
            evidence: z
              .array(
                z
                  .object({
                    message_id: z.string().trim().min(1).max(128),
                    excerpt: z.string().trim().min(1).max(500),
                    type: z.enum(['strength', 'improvement']),
                    explanation: z.string().trim().min(3).max(400),
                  })
                  .strict()
              )
              .max(5),
          })
          .strict()
      )
      .min(1)
      .max(6),
    strengths: z.array(z.string().trim().min(3).max(300)).max(6),
    improvements: z
      .array(
        z
          .object({
            action: z.string().trim().min(3).max(300),
            why_it_matters: z.string().trim().min(3).max(350),
            evidence_message_ids: z.array(z.string().trim().min(1).max(128)).max(5),
          })
          .strict()
      )
      .max(5),
    next_practice: z
      .object({
        competency_key: z.string().trim().min(2).max(100),
        suggested_activity_type: z.string().trim().min(2).max(60),
        reason: z.string().trim().min(5).max(400),
      })
      .strict(),
  })
  .strict();

export const GenerateEvaluationRequestSchema = z
  .object({
    sessionId: SafeIdSchema,
    scenario: z
      .object({
        id: SafeIdSchema,
        title: z.string().trim().min(2).max(200),
        context: z.string().trim().min(5).max(2000),
        prompt: z.string().trim().min(5).max(2000),
        constraints: z.array(z.string().trim().max(400)).max(10),
        learningObjectives: z.array(z.string().trim().max(400)).max(10),
        rubricVersion: z.number().int().min(1).max(100),
      })
      .strict(),
    targetParticipant: z
      .object({
        pseudonym: z.string().trim().min(1).max(60),
        experienceBand: z.enum(EXPERIENCE_BANDS),
      })
      .strict(),
    messages: z
      .array(
        z
          .object({
            id: SafeIdSchema,
            authorRole: z.enum(['target', 'peer']),
            authorPseudonym: z.string().trim().min(1).max(60),
            phase: z.string().trim().min(1).max(40),
            messageType: z.enum(MESSAGE_TYPES),
            body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
            createdAtMs: z.number().int().nonnegative(),
          })
          .strict()
      )
      .min(1)
      .max(120),
  })
  .strict();

export const ArenaTurnRequestSchema = z
  .object({
    arenaId: SafeIdSchema,
    mode: z.enum(AI_ARENA_MODES),
    activePersonas: z.array(z.enum(AI_PERSONA_ROLES)).min(1).max(4),
    scenario: z
      .object({
        id: SafeIdSchema,
        title: z.string().trim().min(2).max(200),
        context: z.string().trim().min(5).max(2000),
        prompt: z.string().trim().min(5).max(2000),
        constraints: z.array(z.string().trim().max(400)).max(10),
      })
      .strict(),
    learnerMessage: z.string().trim().min(2).max(MAX_MESSAGE_LENGTH),
    history: z
      .array(
        z
          .object({
            senderType: z.enum(['learner', 'ai']),
            senderDisplayName: z.string().trim().min(1).max(80),
            personaRole: z.enum(AI_PERSONA_ROLES).nullable(),
            body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
          })
          .strict()
      )
      .max(40),
  })
  .strict();

export const ArenaTurnOutputSchema = z
  .object({
    replies: z
      .array(
        z
          .object({
            personaRole: z.enum(AI_PERSONA_ROLES),
            body: z.string().trim().min(5).max(1600),
            coachingHint: z.string().trim().min(5).max(400),
          })
          .strict()
      )
      .min(1)
      .max(3),
  })
  .strict();

export const IssueMediaTokenRequestSchema = z
  .object({
    sessionId: SafeIdSchema,
    mediaMode: z.enum(['audio', 'audio_video']),
    consentAccepted: z.literal(true),
  })
  .strict();

