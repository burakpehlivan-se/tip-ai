# TIP-AI Technical Debt Audit

**Audit date:** 2026-08-11  
**Scope:** TypeScript/Next.js source, build configuration, persistence, authentication, test layout, and deployment configuration. The working tree contained unrelated user changes; this audit is read-only and does not classify those changes as defects.

## Executive summary

TIP-AI has a solid safety-oriented foundation: role checks protect the admin routes, published cases now have a clinical validation gate, and the primary case store uses atomic writes and a single-writer deployment guard. The largest remaining risks are at boundaries rather than in domain logic: privileged case APIs accept untyped JSON, student attempts use a second and materially weaker JSON store, and a client workspace still imports a server-capable laboratory module through a webpack fallback. These are addressable without a framework rewrite. The recommended first increment is three small, independently releasable changes: typed request parsing, resilient attempt persistence, and a strict server/client laboratory boundary.

`npm audit --omit=dev` could not reach the npm advisory endpoint because DNS resolution for `registry.npmjs.org` failed. This audit therefore makes no claim about current dependency CVEs; the same command should run in networked CI.

## Mental model

The app is a Next.js 16 clinical decision simulation system. Public and student routes create server-owned simulation attempts; admin routes maintain cases, users, audit logs, backups, rules, and validation reports. Domain logic is mostly in `src/lib` (CDM conversion/validation, scoring, lab generation, and JSON-backed stores). The deployed runtime is a single Node process with `/app/data` persisted as a Docker volume; it is intentionally not multi-replica safe.

## Findings

| ID | Category | Evidence | Severity | Effort | Description | Recommendation |
|---|---|---|---|---:|---|---|
| TD-01 | Type and contract debt | `src/app/api/admin/cases/[id]/route.ts:49-95`, `src/app/api/admin/cases/route.ts:38-104` | High | 4–6 h | Privileged case create/update handlers accept arbitrary JSON, cast selected fields with `as any`, and only partly coerce values. The clinical publication check runs after this boundary, so malformed draft data can still enter the repository and cause later failures. | Add small explicit create/update parsers that return a typed DTO plus field-specific 400 responses; reuse them in both routes. Do not add a broad schema framework unless more than these boundaries need it. |
| TD-02 | Data integrity and availability | `src/lib/student/attempt-store.ts:29-49`, `src/lib/student/attempt-store.ts:132-192`; contrast `src/lib/admin/store.ts:33-79` | High | 4–6 h | Student attempts use a separate direct JSON store. It silently treats every read/parse failure as an empty store, does not use the single-writer guard, does not serialize mutations, and writes without file/directory fsync. A malformed or concurrent write can discard active learner progress without an observable error. | Move attempts onto the shared JSON persistence primitives (atomic write, corruption quarantine, single-writer assertion, and mutation lock) while retaining the 12-hour TTL and current public API. |
| TD-03 | Architecture and performance | `src/components/vaka/VakaWorkspace.tsx:270-290`, `next.config.mjs:8-17` | High | 6–10 h | The 1,108-line, highest-churn workspace imports code that can reach filesystem-backed lab/rule storage. The client bundle is made to compile by `fs: false`; the config itself documents the missing server/client split. This makes an accidental client-side server dependency easier to introduce and complicates bundle analysis. | Define a client-safe lab-result contract. Resolve generated test data in the student attempt API; pass it to the workspace instead of importing server-capable lab code from a client component. |
| TD-04 | Consistency and correctness | `src/lib/cdm/validate.ts:28-318`, `src/lib/cdm/validate-report.ts:87-818` | Medium | 6–8 h | The same CDM document is checked by two independent validators with different issue shapes and different strictness. Import validation, reporting, and publication can drift as new clinical fields are introduced. | Keep two explicit policies—`import` and `publication`—but implement shared field rules and a single issue model. Preserve existing external response contracts with adapters during migration. |
| TD-05 | Test debt | Critical mutation routes at `src/app/api/admin/cases/route.ts:33-143` and `src/app/api/admin/cases/[id]/route.ts:36-142`; no sibling route test files | Medium | 5–7 h | The suite has unit coverage for auth, stores, scoring, CDM, and student attempts, but the admin case mutation routes that enforce RBAC and publication gating have no request-level regression tests. | Add route tests for unauthorized access, malformed payloads, draft save, failed activation, successful activation, and audit-log creation. Run these in the default `npm test` command. |
| TD-06 | Maintainability | `src/components/vaka/VakaWorkspace.tsx:289`, `src/components/vaka/VakaWorkspace.tsx` (1,108 LOC; 28 touches in last 80 commits), `src/lib/data/case-generator.ts` (1,880 LOC) | Medium | 6–10 h | The main learner workspace is both a UI hot spot and a state/orchestration module; it contains a `@ts-ignore`. The static case generator is also very large. Changes to either have disproportionate regression risk. | Remove the type suppression first; then extract only stable seams (attempt transport, test-request state, and message construction). Keep rendering components in place until behaviour tests cover the extracted seam. |
| TD-07 | Operability and documentation drift | `.env.example:12-14`, `Dockerfile:15-32`, `src/lib/admin/paths.ts:4-26`; no repository `README.md` | Medium | 2–3 h | The environment sample advertises Prisma/SQLite and `DATABASE_URL`, but the current runtime uses JSON files under `/app/data/admin`; there is no primary runbook for setup, backup/restore, single-replica limits, or audit commands. | Replace the stale database section with the JSON-store deployment contract and add a short README/runbook. Document the trigger for a future database migration rather than implying one already exists. |
| TD-08 | Observability | `src/lib/student/attempt-store.ts:35-42`, `src/lib/lab-motor.ts:20,199,209`, `src/components/vaka/VakaWorkspace.tsx:236-367` | Low | 2–4 h | Several catches intentionally degrade gracefully, but attempt-store failures are indistinguishable from “no attempt”. This prevents support staff from diagnosing lost progress. | Log and classify server persistence failures; leave client-facing wording generic. Do not turn expected “missing file” cases into error noise. |

## Top priorities

1. **TD-01 — typed case request parsing.** Highest safety-to-effort ratio; prevents invalid data before it reaches clinical validation and audit logs.
2. **TD-02 — resilient student attempt persistence.** Protects active learner progress and closes the largest data-loss gap.
3. **TD-03 — server/client lab boundary.** Removes the webpack filesystem workaround from the critical student workspace and protects bundle/runtime boundaries.
4. **TD-05 — route-level regression tests.** Locks the first two fixes and the publication safety gate into CI.
5. **TD-04 — unify CDM rule implementation.** Reduces future maintenance cost after the safety-critical paths are protected.

## Quick wins

- [ ] Replace the `@ts-ignore` at `src/components/vaka/VakaWorkspace.tsx:289` with an explicit common `TestSonucu` result type.
- [ ] Add an audit CI job that runs `npm audit --omit=dev --audit-level=high` in a networked environment.
- [ ] Add `TIP_AI_REPLICA_COUNT=1` and `/app/data` persistence requirements to the deployment documentation.
- [ ] Return a stable `code` alongside the active-case publication error so the admin UI can render actionable validation feedback.

## Looks bad but is fine

- The inline boot script in `src/app/layout.tsx:42-43` uses `dangerouslySetInnerHTML`, but its content is static, contains no user data, and exists to prevent the known unstyled-first-paint issue. It is not an XSS sink under the current implementation.
- The primary admin store uses synchronous I/O in `src/lib/admin/store.ts:60-79`. For the documented single-process deployment this is deliberate: it permits atomic replace plus fsync and avoids asynchronous read–modify–write races.
- The single-replica check in `src/lib/admin/paths.ts:9-18` is a useful fail-fast constraint, not a scalability bug by itself. The debt is that other stores have not consistently adopted the same contract.

## Open questions

1. What is the actual performance SLO represented by `[XYZ]` (for example, student attempt API P95 or mobile LCP)?
2. Is the planned deployment permanently a single persistent container, or is horizontal scaling/serverless hosting expected within the next two quarters?
3. Are guest attempts expected to survive a container restart, or is a 12-hour best-effort continuation sufficient?
4. Does “uzman onayı” need a distinct reviewer workflow and immutable approval audit trail before cases are used in formal assessment?
