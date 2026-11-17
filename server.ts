import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { verifyFirebaseRequest } from './server/auth';
import { SlidingWindowRateLimiter } from './server/rateLimit';
import { GeminiEvaluationProvider } from './server/evaluationAdapter';
import { GeminiArenaProvider } from './server/arenaAdapter';
import {
  ArenaTurnRequestSchema,
  GenerateEvaluationRequestSchema,
  IssueMediaTokenRequestSchema,
} from './packages/validation/src/schemas';
import type { ApiErrorCode, MediaTokenResponseData } from './packages/contracts/src/api';

const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = 'gaziwahab58@gmail.com';
const evaluationLimiter = new SlidingWindowRateLimiter(10, 60 * 60 * 1000);
const arenaLimiter = new SlidingWindowRateLimiter(30, 60 * 60 * 1000);

const runtimeFlags = {
  aiEvaluationEnabled: true,
  aiArenaEnabled: true,
  mediaStageEnabled: true,
};

function makeRequestId(): string {
  return crypto.randomUUID();
}

function sendError(
  res: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId: string
): void {
  res.status(status).json({
    error: { code, message },
    meta: { requestId },
  });
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.use(express.json({ limit: '128kb' }));

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({
      data: {
        status: 'ok',
        aiConfigured: Boolean(process.env.GEMINI_API_KEY),
        livekitConfigured: Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY),
        flags: { ...runtimeFlags },
      },
      meta: { requestId: makeRequestId() },
    });
  });

  app.post('/api/v1/admin/flags', async (req: Request, res: Response) => {
    const requestId = makeRequestId();
    const actor = await verifyFirebaseRequest(req);
    if (!actor) {
      sendError(res, 401, 'UNAUTHENTICATED', 'Valid Firebase authentication token required.', requestId);
      return;
    }
    if (actor.email?.toLowerCase() !== ADMIN_EMAIL || !actor.emailVerified) {
      sendError(res, 403, 'FORBIDDEN', 'Admin privileges required to update runtime feature switches.', requestId);
      return;
    }

    const body = req.body as Partial<typeof runtimeFlags> | undefined;
    if (body && typeof body === 'object') {
      if (typeof body.aiEvaluationEnabled === 'boolean') {
        runtimeFlags.aiEvaluationEnabled = body.aiEvaluationEnabled;
      }
      if (typeof body.aiArenaEnabled === 'boolean') {
        runtimeFlags.aiArenaEnabled = body.aiArenaEnabled;
      }
      if (typeof body.mediaStageEnabled === 'boolean') {
        runtimeFlags.mediaStageEnabled = body.mediaStageEnabled;
      }
    }

    res.json({
      data: { flags: { ...runtimeFlags } },
      meta: { requestId },
    });
  });

  app.post('/api/v1/evaluations/generate', async (req: Request, res: Response) => {
    const requestId = makeRequestId();

    const actor = await verifyFirebaseRequest(req);
    if (!actor) {
      sendError(res, 401, 'UNAUTHENTICATED', 'Valid Firebase authentication token required.', requestId);
      return;
    }

    if (!actor.emailVerified) {
      sendError(res, 403, 'FORBIDDEN', 'Verified account email is required.', requestId);
      return;
    }

    if (!runtimeFlags.aiEvaluationEnabled) {
      sendError(
        res,
        503,
        'PROVIDER_UNAVAILABLE',
        'AI evaluation generation is temporarily paused by an administrator.',
        requestId
      );
      return;
    }

    const rate = evaluationLimiter.consume(`eval:${actor.uid}`);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendError(
        res,
        429,
        'RATE_LIMITED',
        'Evaluation limit reached. Please wait before requesting another report.',
        requestId
      );
      return;
    }

    const parsed = GenerateEvaluationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'INVALID_INPUT', 'Invalid evaluation payload.', requestId);
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      sendError(
        res,
        503,
        'PROVIDER_UNAVAILABLE',
        'AI evaluation service is not currently configured.',
        requestId
      );
      return;
    }

    try {
      const provider = new GeminiEvaluationProvider(apiKey);
      const result = await provider.evaluateSession({
        sessionId: parsed.data.sessionId,
        targetUid: actor.uid,
        targetPseudonym: parsed.data.targetParticipant.pseudonym,
        experienceBand: parsed.data.targetParticipant.experienceBand,
        scenario: parsed.data.scenario,
        messages: parsed.data.messages,
      });

      res.json({
        data: {
          provider: result.provider,
          model: result.model,
          promptVersion: result.promptVersion,
          rubricVersion: parsed.data.scenario.rubricVersion,
          report: result.report,
          evidenceRejectedCount: result.evidenceRejectedCount,
        },
        meta: { requestId },
      });
    } catch (err) {
      console.error(`[${requestId}] Evaluation generation error:`, err instanceof Error ? err.message : 'Unknown error');
      sendError(
        res,
        503,
        'PROVIDER_UNAVAILABLE',
        'Evaluation provider could not complete the request. Your session data remains saved; please retry later.',
        requestId
      );
    }
  });

  app.post('/api/v1/arena/respond', async (req: Request, res: Response) => {
    const requestId = makeRequestId();

    const actor = await verifyFirebaseRequest(req);
    if (!actor) {
      sendError(res, 401, 'UNAUTHENTICATED', 'Valid Firebase authentication token required.', requestId);
      return;
    }

    if (!actor.emailVerified) {
      sendError(res, 403, 'FORBIDDEN', 'Verified account email is required.', requestId);
      return;
    }

    if (!runtimeFlags.aiArenaEnabled) {
      sendError(
        res,
        503,
        'PROVIDER_UNAVAILABLE',
        'AI Practice Arena is temporarily paused by an administrator.',
        requestId
      );
      return;
    }

    const rate = arenaLimiter.consume(`arena:${actor.uid}`);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendError(
        res,
        429,
        'RATE_LIMITED',
        'Arena practice rate limit reached. Take a short breather before sending more turns.',
        requestId
      );
      return;
    }

    const parsed = ArenaTurnRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'INVALID_INPUT', 'Invalid AI Practice Arena turn payload.', requestId);
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      sendError(
        res,
        503,
        'PROVIDER_UNAVAILABLE',
        'AI Practice Arena service is not currently configured.',
        requestId
      );
      return;
    }

    try {
      const provider = new GeminiArenaProvider(apiKey);
      const result = await provider.generateTurn({
        arenaId: parsed.data.arenaId,
        mode: parsed.data.mode,
        activePersonas: parsed.data.activePersonas,
        scenario: parsed.data.scenario,
        history: parsed.data.history,
        learnerMessage: parsed.data.learnerMessage,
      });

      res.json({
        data: result,
        meta: { requestId },
      });
    } catch (err) {
      console.error(`[${requestId}] Arena turn error:`, err instanceof Error ? err.message : 'Unknown error');
      sendError(
        res,
        503,
        'PROVIDER_UNAVAILABLE',
        'AI persona provider could not respond right now. Please retry your turn.',
        requestId
      );
    }
  });

  app.post('/api/v1/media/token', async (req: Request, res: Response) => {
    const requestId = makeRequestId();

    const actor = await verifyFirebaseRequest(req);
    if (!actor) {
      sendError(res, 401, 'UNAUTHENTICATED', 'Valid Firebase authentication token required.', requestId);
      return;
    }

    if (!runtimeFlags.mediaStageEnabled) {
      sendError(
        res,
        503,
        'PROVIDER_UNAVAILABLE',
        'Audio/Video room stage is currently disabled by an administrator.',
        requestId
      );
      return;
    }

    const parsed = IssueMediaTokenRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'INVALID_INPUT', 'Explicit media consent and valid room parameters are required.', requestId);
      return;
    }

    const expiresAtMs = Date.now() + 60 * 60 * 1000;
    const roomName = `eng-room-${parsed.data.sessionId}`;
    const signature = crypto
      .createHmac('sha256', process.env.LIVEKIT_API_SECRET || 'ephemeral-stage-secret')
      .update(`${roomName}:${actor.uid}:${parsed.data.mediaMode}:${expiresAtMs}`)
      .digest('hex');

    const responseData: MediaTokenResponseData = {
      sessionId: parsed.data.sessionId,
      provider: process.env.LIVEKIT_URL ? 'livekit' : 'webrtc_local_stage',
      token: `stage_${Buffer.from(
        JSON.stringify({
          sub: actor.uid,
          room: roomName,
          mode: parsed.data.mediaMode,
          exp: Math.floor(expiresAtMs / 1000),
          sig: signature.slice(0, 24),
        })
      ).toString('base64url')}`,
      wsUrl: process.env.LIVEKIT_URL || null,
      mediaMode: parsed.data.mediaMode,
      expiresAtMs,
    };

    res.json({
      data: responseData,
      meta: { requestId },
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Engineering Practice Platform server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
