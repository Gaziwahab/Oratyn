import type { CompetencyItem, DomainItem, ScenarioItem } from './types';

export const PILOT_DOMAINS: readonly DomainItem[] = [
  {
    id: 'domain-backend-apis',
    slug: 'backend-apis',
    title: 'Backend & API Reliability',
    description: 'Diagnose production bottlenecks, design resilient boundaries, and evaluate caching and retry trade-offs.',
    order: 1,
    status: 'published',
  },
  {
    id: 'domain-system-design',
    slug: 'system-design',
    title: 'System Design',
    description: 'Reason about scale, partitioning, consistency, latency budgets, and pragmatic architecture trade-offs.',
    order: 2,
    status: 'published',
  },
  {
    id: 'domain-databases',
    slug: 'databases',
    title: 'Databases & Data Modelling',
    description: 'Compare indexing strategies, transactions, isolation levels, and query execution trade-offs.',
    order: 3,
    status: 'published',
  },
  {
    id: 'domain-code-review',
    slug: 'code-review',
    title: 'OOP, Code Review & Maintainability',
    description: 'Spot correctness bugs, security pitfalls, coupling issues, and deliver constructive code reviews.',
    order: 4,
    status: 'published',
  },
  {
    id: 'domain-os-concurrency',
    slug: 'os-concurrency',
    title: 'OS & Concurrency',
    description: 'Reason about race conditions, deadlocks, thread pools, memory contention, and async execution.',
    order: 5,
    status: 'published',
  },
  {
    id: 'domain-dsa-tradeoffs',
    slug: 'dsa-tradeoffs',
    title: 'Data Structures & Algorithm Trade-Offs',
    description: 'Defend data structure choices under real memory, latency, and workload constraints.',
    order: 6,
    status: 'published',
  },
];

export const PILOT_COMPETENCIES: readonly CompetencyItem[] = [
  {
    id: 'comp-systematic-debugging',
    slug: 'systematic_debugging',
    domainId: 'domain-backend-apis',
    title: 'Systematic Debugging',
    description: 'Separates symptoms from root causes and proposes evidence-gathering diagnostics before fixes.',
  },
  {
    id: 'comp-reliability-tradeoffs',
    slug: 'reliability_tradeoff_reasoning',
    domainId: 'domain-backend-apis',
    title: 'Reliability Trade-Off Reasoning',
    description: 'Weighs timeouts, retries, caching, rate limits, and graceful degradation failure modes.',
  },
  {
    id: 'comp-scalability-design',
    slug: 'scalability_architecture',
    domainId: 'domain-system-design',
    title: 'Scalability & Architecture Reasoning',
    description: 'Identifies bottlenecks, read/write ratios, and pragmatic scaling steps.',
  },
  {
    id: 'comp-db-tradeoffs',
    slug: 'database_tradeoff_reasoning',
    domainId: 'domain-databases',
    title: 'Database & Indexing Trade-Offs',
    description: 'Balances read latency, write amplification, locking, and consistency guarantees.',
  },
  {
    id: 'comp-constructive-review',
    slug: 'constructive_code_review',
    domainId: 'domain-code-review',
    title: 'Constructive Code Review',
    description: 'Identifies security, correctness, and maintainability risks with clear rationale.',
  },
  {
    id: 'comp-concurrency-reasoning',
    slug: 'concurrency_reasoning',
    domainId: 'domain-os-concurrency',
    title: 'Concurrency & Contention Reasoning',
    description: 'Detects race conditions, lock contention, and resource exhaustion hazards.',
  },
];

export const PILOT_SCENARIOS: readonly ScenarioItem[] = [
  {
    id: 'scen-api-timeout-under-load',
    slug: 'api-timeout-under-load',
    domainId: 'domain-backend-apis',
    domainTitle: 'Backend & API Reliability',
    topicTitle: 'API Reliability',
    title: 'Diagnose an API that slows down under load',
    roomType: 'incident',
    difficulty: 'intermediate',
    estimatedMinutes: 25,
    participationMode: 'both',
    context:
      'An API service that previously handled normal traffic now shows elevated p95 latency (rising from 120ms to 4.2s) and 504 timeouts during peak traffic. The team has a tight budget and incomplete observability.',
    prompt:
      'Explain what clarifying questions you would ask first, what telemetry or logs you would inspect, what hypotheses you would test in priority order, and which safe short-term mitigation you would apply.',
    constraints: [
      'You cannot immediately provision additional application servers.',
      'Distributed tracing is not yet enabled; you only have basic HTTP logs and host CPU/memory metrics.',
      'Clients currently retry failed requests automatically up to 3 times.',
    ],
    learningObjectives: [
      'Ask clarifying questions before prescribing an architecture rewrite.',
      'Separate symptoms from root causes across app, database, network, and downstream dependencies.',
      'Evaluate side effects of retries and naive caching under load.',
    ],
    prerequisites: ['HTTP request lifecycle', 'Basic database and caching concepts'],
    competencies: ['systematic_debugging', 'reliability_tradeoff_reasoning'],
    strongSignals: [
      'Recognizes retry amplification risk from client auto-retries',
      'Checks connection pool saturation and slow queries before guessing',
      'Distinguishes p95 vs p50 latency behavior',
    ],
    rubricVersion: 1,
    status: 'published',
    codeArtifact: `// telemetry/api-gateway.log & pool-config.ts
[14:02:11.104] WARN  http.server - GET /v1/orders?merchantId=882 p95=4210ms status=504
[14:02:11.420] ERROR db.pool     - Timeout acquiring connection from pool (max=10, active=10, waiting=84)
[14:02:11.512] INFO  client.sdk  - Auto-retry attempt 2/3 triggered for /v1/orders?merchantId=882

export async function getMerchantOrders(req: Request, res: Response) {
  // Acquires connection before checking cache or rate limits
  const client = await pgPool.connect();
  try {
    const rows = await client.query(
      'SELECT * FROM orders WHERE merchant_id = $1 ORDER BY created_at DESC',
      [req.query.merchantId]
    );
    const enriched = await fetchInventoryStatusWithNoTimeout(rows.rows);
    return res.json({ items: enriched });
  } finally {
    client.release();
  }
}`,
  },
  {
    id: 'scen-scalable-url-shortener',
    slug: 'design-scalable-url-shortener',
    domainId: 'domain-system-design',
    domainTitle: 'System Design',
    topicTitle: 'High-Read Web Services',
    title: 'Design a scalable URL shortener',
    roomType: 'system_design',
    difficulty: 'beginner',
    estimatedMinutes: 30,
    participationMode: 'both',
    context:
      'Your team is building a URL shortening service expected to handle 100M redirects/day and 1M new short links/day. Redirect latency must stay low globally, and custom aliases must not collide.',
    prompt:
      'Propose the core data model, short-code generation strategy, caching layer, and redirect path. Defend your database and cache choices against peer challenges.',
    constraints: [
      'Read-to-write ratio is roughly 100:1.',
      'Redirect p99 latency target is under 50ms.',
      'Short codes should be unpredictable enough that competitors cannot trivially enumerate all links.',
    ],
    learningObjectives: [
      'Estimate read/write QPS and storage footprint cleanly.',
      'Compare base62 counter encoding vs random hash/KGS approaches.',
      'Justify Redis cache-aside vs write-through and eviction risks.',
    ],
    prerequisites: ['REST APIs', 'Relational vs key-value storage basics'],
    competencies: ['scalability_architecture', 'database_tradeoff_reasoning'],
    strongSignals: [
      'Separates write path consistency from read path caching',
      'Addresses collision handling and enumeration resistance',
      'Discusses cache stampede or Redis unavailability fallback',
    ],
    rubricVersion: 1,
    status: 'published',
    codeArtifact: `// Draft schema & redirect handler under design review
CREATE TABLE short_links (
  code VARCHAR(12) PRIMARY KEY,
  target_url TEXT NOT NULL,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

export async function handleRedirect(code: string) {
  const cachedUrl = await redis.get(\`short:\${code}\`);
  if (cachedUrl) return { status: 302, location: cachedUrl };

  // Question for design review: what happens on cache miss stampede for viral links?
  const row = await db.query('SELECT target_url FROM short_links WHERE code = $1', [code]);
  if (!row) return { status: 404 };
  await redis.set(\`short:\${code}\`, row.target_url, 'EX', 3600);
  return { status: 302, location: row.target_url };
}`,
  },
  {
    id: 'scen-db-cpu-95-indexing',
    slug: 'database-cpu-95-indexing',
    domainId: 'domain-databases',
    domainTitle: 'Databases & Data Modelling',
    topicTitle: 'Indexing & Query Plans',
    title: 'Investigate 95% database CPU and slow order lookups',
    roomType: 'debug',
    difficulty: 'intermediate',
    estimatedMinutes: 25,
    participationMode: 'both',
    context:
      'A PostgreSQL primary database powering an e-commerce checkout dashboard is pegged at 95% CPU. A table with 40M `orders` rows receives frequent writes and heavy filtered dashboard queries by `(merchant_id, status, created_at)`.',
    prompt:
      'How would you diagnose the CPU spike using query plans and database metrics? Which index or query changes would you propose, and what write-side trade-offs must you consider?',
    constraints: [
      'Downtime or table-locking migrations during business hours are unacceptable.',
      'Write throughput peaks at 2,500 inserts/updates per second.',
    ],
    learningObjectives: [
      'Reason about composite index column order and selectivity.',
      'Balance read speedup against write amplification and vacuum overhead.',
      'Explain online/concurrent index creation.',
    ],
    prerequisites: ['SQL WHERE/ORDER BY', 'B-tree index fundamentals'],
    competencies: ['database_tradeoff_reasoning', 'systematic_debugging'],
    strongSignals: [
      'Inspects pg_stat_statements / EXPLAIN ANALYZE first',
      'Explains composite index prefix ordering (merchant_id, status, created_at)',
      'Considers write amplification and CREATE INDEX CONCURRENTLY',
    ],
    rubricVersion: 1,
    status: 'published',
    codeArtifact: `-- EXPLAIN (ANALYZE, BUFFERS) output from production replica
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, total_cents, customer_email, created_at
FROM orders
WHERE merchant_id = 'm_99481'
  AND status = 'PROCESSING'
ORDER BY created_at DESC
LIMIT 50;

-- Sort  (cost=482190.44..482215.10 rows=9864 width=64) (actual time=1842.11..1842.19 rows=50 loops=1)
--   Sort Key: created_at DESC
--   Buffers: shared hit=192400 read=84120
--   -> Index Scan using idx_orders_created_at on orders  (actual time=12.40..1839.50 rows=14200 loops=1)
--        Filter: ((merchant_id = 'm_99481') AND (status = 'PROCESSING'))
--        Rows Removed by Filter: 3985800`,
  },
  {
    id: 'scen-redis-outage-debate',
    slug: 'redis-unavailable-failover-debate',
    domainId: 'domain-backend-apis',
    domainTitle: 'Backend & API Reliability',
    topicTitle: 'Caching & Degradation',
    title: 'Debate: Fail open or fail closed when Redis becomes unavailable?',
    roomType: 'debate',
    difficulty: 'intermediate',
    estimatedMinutes: 25,
    participationMode: 'both',
    context:
      'Your platform uses a single Redis cluster for three workloads: (1) product catalogue caching, (2) API rate limiting, and (3) user session revocation checks. Tonight, Redis becomes unreachable for 15 minutes.',
    prompt:
      'Take and defend a position on how each of the three workloads should degrade when Redis is down. Challenge peers who apply one blanket fail-open or fail-closed rule to everything.',
    constraints: [
      'The primary relational database will collapse if all cached traffic hits it unthrottled.',
      'Revoked or suspended user tokens must remain blocked on sensitive endpoints.',
    ],
    learningObjectives: [
      'Distinguish security invariants from availability trade-offs per workload.',
      'Design circuit breakers, stale-while-revalidate, and bounded local fallbacks.',
      'Defend or revise a stance under counterarguments.',
    ],
    prerequisites: ['Caching patterns', 'Authentication/session basics'],
    competencies: ['reliability_tradeoff_reasoning', 'scalability_architecture'],
    strongSignals: [
      'Separates security-critical revocation (fail closed/fallback check) from catalogue cache (circuit breaker/degrade)',
      'Identifies thundering herd risk on primary DB',
    ],
    rubricVersion: 1,
    status: 'published',
    codeArtifact: `// shared-redis-middleware.ts (Current blanket implementation)
export async function checkSessionAndRateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const isRevoked = await redis.get(\`revoked:\${req.tokenId}\`);
    if (isRevoked) return res.status(401).json({ error: 'Token revoked' });

    const count = await redis.incr(\`ratelimit:\${req.ip}\`);
    if (count > 200) return res.status(429).json({ error: 'Too many requests' });
    return next();
  } catch (redisErr) {
    // Debate: Should this catch block fail open (next()) or fail closed (503)?
    // How should catalogue cache, rate limits, and token revocation differ?
    return next();
  }
}`,
  },
  {
    id: 'scen-auth-webhook-code-review',
    slug: 'payment-webhook-handler-review',
    domainId: 'domain-code-review',
    domainTitle: 'OOP, Code Review & Maintainability',
    topicTitle: 'Security & Defensive Code Review',
    title: 'Code Review: Audit a webhook & entitlement endpoint',
    roomType: 'code_review',
    difficulty: 'beginner',
    estimatedMinutes: 20,
    participationMode: 'both',
    context:
      'A junior teammate opened a PR for a billing webhook handler that parses `req.body` as JSON, trusts `event.userId`, skips signature verification in staging/fallback, and increments user credits without checking prior `event.id` values.',
    prompt:
      'Conduct a constructive code review. Prioritize the most critical security and correctness defects, explain *why* each is exploitable or fragile, and suggest clean, minimal fixes.',
    constraints: [
      'Your review tone must be collaborative and evidence-based—critique the code, not the author.',
      'Payment provider retries webhooks up to 5 times if responses exceed 3 seconds.',
    ],
    learningObjectives: [
      'Spot signature bypass, replay/idempotency gaps, and raw-body verification mistakes.',
      'Separate blocking security defects from minor style feedback.',
      'Write actionable, respectful review comments.',
    ],
    prerequisites: ['HTTP APIs', 'JSON parsing and basic backend handlers'],
    competencies: ['constructive_code_review', 'reliability_tradeoff_reasoning'],
    strongSignals: [
      'Flags raw body signature verification and fail-closed checks',
      'Identifies idempotency key requirement on webhook event ID',
      'Uses constructive, non-shaming review phrasing',
    ],
    rubricVersion: 1,
    status: 'published',
    codeArtifact: `// PR #418: routes/billingWebhook.ts
app.post('/webhooks/billing', express.json(), async (req, res) => {
  const sig = req.headers['x-billing-signature'] as string | undefined;
  if (process.env.NODE_ENV === 'production' && sig) {
    const expected = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET || '')
      .update(JSON.stringify(req.body))
      .digest('hex');
    if (sig !== expected) {
      console.warn('Signature mismatch, continuing in compatibility mode');
    }
  }

  const { id, type, userId, creditsPurchased } = req.body;
  if (type === 'invoice.paid') {
    await db.query(
      'UPDATE user_wallets SET credits = credits + $1 WHERE user_id = $2',
      [creditsPurchased, userId]
    );
    await sendReceiptEmailSync(userId, creditsPurchased);
  }
  res.json({ received: true, eventId: id });
});`,
  },
  {
    id: 'scen-race-condition-inventory',
    slug: 'concurrency-double-booking-race',
    domainId: 'domain-os-concurrency',
    domainTitle: 'OS & Concurrency',
    topicTitle: 'Race Conditions & Locking',
    title: 'Fix a room-capacity race condition under concurrent joins',
    roomType: 'teach',
    difficulty: 'beginner',
    estimatedMinutes: 20,
    participationMode: 'both',
    context:
      'Two users click "Join Session" at the exact same millisecond when 5 of 6 seats are taken. The handler reads `count = 5`, verifies `5 < 6`, and both requests write a participant record—leaving 7 participants in a 6-seat room.',
    prompt:
      'Explain clearly to a beginner peer why this check-then-act race condition happens across concurrent requests, and compare optimistic concurrency/transactions vs pessimistic locking to fix it.',
    constraints: [
      'The app runs across multiple stateless server instances, so an in-memory JavaScript mutex will not work.',
    ],
    learningObjectives: [
      'Explain TOCTOU (time-of-check to time-of-use) races in plain engineering language.',
      'Compare database transactions, atomic conditional updates, and distributed locks.',
      'Respond clearly to clarifying questions from peers.',
    ],
    prerequisites: ['Basic async/await and database reads/writes'],
    competencies: ['concurrency_reasoning', 'database_tradeoff_reasoning'],
    strongSignals: [
      'Identifies why process-local locks fail across multiple instances',
      'Explains transaction retry / atomic invariant enforcement clearly',
    ],
    rubricVersion: 1,
    status: 'published',
    codeArtifact: `// services/joinRoom.ts — Vulnerable check-then-act handler
export async function joinDiscussionRoom(roomId: string, userId: string) {
  const room = await db.rooms.findUnique({ where: { id: roomId } });
  if (!room) throw new Error('Room not found');

  if (room.participantCount >= room.capacity) {
    throw new Error('Room is already full');
  }

  // Concurrent request B reads participantCount = 5 before request A writes 6
  await db.participants.create({ data: { roomId, userId } });
  await db.rooms.update({
    where: { id: roomId },
    data: { participantCount: room.participantCount + 1 },
  });
}`,
  },
];
