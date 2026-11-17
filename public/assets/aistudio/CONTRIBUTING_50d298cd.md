# Contributing

## Before contributing

Read `AGENTS.md` and the relevant documents in `docs/`. Product principles and MVP boundaries apply to all contributions, including prototypes.

## Contribution expectations

- Keep changes focused and explain the user problem they solve.
- Link implementation changes to acceptance criteria in `docs/PRD.md` or `docs/MVP_SCOPE.md`.
- Include tests for new behavior and denied-access cases.
- Include database migrations for schema changes.
- Update API, architecture, UX, or setup documentation when contracts change.
- Never include secrets, real user transcripts, personal data, or production exports in commits.
- Avoid dependencies unless they solve a real need and are actively maintained.

## Pull request checklist

- [ ] Requirement and acceptance criteria are clear.
- [ ] The MVP boundary is respected.
- [ ] Authorization is enforced server-side and by RLS where applicable.
- [ ] Validation and failure states are covered.
- [ ] Tests, lint, type checks, and build pass.
- [ ] Accessibility and responsive behavior are checked.
- [ ] Documentation and changelog are updated where needed.
- [ ] No secrets or unrelated changes are included.


## Security requirements for contributions

Before submitting a feature, read `docs/SECURITY_PROTOCOL.md`. Include the Firestore/Storage rules, backend authorization, negative-access tests, input limits, rate limits and audit/retention implications relevant to the change. Never put secrets in source, public environment variables, URLs or logs. Admin SDK operations require server-side authorization because they bypass Firestore Security Rules.
