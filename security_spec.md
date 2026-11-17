# Security Specification & Payload-First TDD

## 1. Core Data Invariants

1. **PII Isolation**: User emails are never stored in `publicProfiles` or `sessions/{id}/messages`. Private user records (`users/{uid}`, `userPreferences/{uid}`) are readable and writable only by the authenticated owner (`request.auth.uid == uid`) or verified admin.
2. **Role & Status Integrity**: Users cannot set `accountStatus` to anything other than `'active'` on signup, cannot modify `accountStatus` later, and cannot write to `admins/{uid}` or `roles/{uid}`.
3. **Catalogue Governance**: Only verified admins (`isAdmin()`) may create, update, or delete `domains`, `competencies`, `scenarios`, and `rubrics`. Signed-in learners can read only `status == 'published'` items.
4. **Session Capacity & Lifecycle Invariant**: Sessions have `capacity` strictly bounded between `2` and `6`. Concurrent joins atomically update `sessions/{sessionId}` (`participantCount` + `participantUids`) alongside `sessions/{sessionId}/participants/{uid}` using Firestore transactions and `getAfter` validation. Completed or cancelled sessions are terminally locked against user edits or new messages.
5. **Membership-Gated Discussions**: Only currently `joined` session participants may post messages in `active` sessions. `senderUid` must equal `request.auth.uid`, and `createdAt` must equal `request.time`.
6. **Private Evaluations**: `users/{uid}/evaluations/{evaluationId}`, `competencyObservations`, and `recommendations` are strictly private to `{uid}` (and system/admin). Peer participants and session hosts cannot read another learner's private evaluation.
7. **Audit & Moderation Isolation**: `userReports` can be created by signed-in reporters (`reporterUid == request.auth.uid`), but reading/resolving the moderation queue and writing `moderationActions` / `auditEvents` are restricted strictly to verified staff/admins.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Privilege Escalation on Profile Create**: `{ uid: "u1", displayName: "Attacker", experienceBand: "student", accountStatus: "active", role: "admin", onboardingCompleted: true, createdAt: serverTimestamp, updatedAt: serverTimestamp }` -> **DENIED** (`hasOnly` rejects unknown `role` field).
2. **Account Status Bypass on Update**: User `u1` updates `users/u1` with `{ accountStatus: "active" }` while suspended -> **DENIED** (`affectedKeys().hasOnly(...)` excludes `accountStatus`).
3. **Cross-User PII Read**: Authenticated user `u2` attempts `get` on `users/u1` or `userPreferences/u1` -> **DENIED**.
4. **Unverified Admin Spoof**: User with unverified email claim attempts write to `scenarios/scen-1` -> **DENIED** (`email_verified == true` required).
5. **Capacity Overflow Attack**: User `u7` attempts to join `sessions/s1` when `participantCount == capacity` (6) -> **DENIED** (`existing().participantCount < existing().capacity`).
6. **Host Hijack**: Participant `u2` updates `sessions/s1` with `{ hostUid: "u2" }` -> **DENIED** (`hostUid` is immutable).
7. **Terminal State Resurrection**: Host or participant updates `sessions/s1` after `status == "completed"` back to `"active"` -> **DENIED** (terminal state lock).
8. **Message Identity Spoofing**: User `u2` creates `sessions/s1/messages/m1` with `senderUid: "u1"` -> **DENIED** (`senderUid == request.auth.uid`).
9. **Non-Member Room Posting**: Authenticated non-participant `u9` posts to `sessions/s1/messages/m2` -> **DENIED** (parent session membership check fails).
10. **Oversized Denial-of-Wallet Payload**: Participant posts a 50KB string in `body` or a 1KB junk document ID -> **DENIED** (`isValidId` and `.size() <= 4000`).
11. **Timestamp Forgery**: Client submits `createdAt: new Date(0)` instead of `request.time` -> **DENIED** (`createdAt == request.time`).
12. **Private Report Snooping**: Session host `u1` attempts `get` or `list` on `users/u2/evaluations` -> **DENIED** (strict owner isolation).
