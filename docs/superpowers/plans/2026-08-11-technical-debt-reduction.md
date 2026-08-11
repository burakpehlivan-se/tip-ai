# Technical Debt Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the three highest-risk technical debts—untyped admin case input, fragile learner-attempt persistence, and the client/server laboratory boundary—without changing student-facing clinical behaviour.

**Architecture:** Keep the existing Next.js and JSON-store architecture for this increment. Introduce small, focused boundary modules: one request parser for admin case mutations and one shared JSON persistence utility used by student attempts. Keep lab generation on the server-owned attempt path and pass only client-safe test results to the workspace. Do not introduce Prisma, a database migration, a state-management library, or a general-purpose validation framework in this plan.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Node.js filesystem persistence.

## Global constraints

- **Performance SLO:** `[XYZ]` is not yet specified. Before implementation, capture baseline P50/P95 latency for `GET/POST /api/student/attempts` and the initial student route. Until `[XYZ]` is supplied, no median or P95 result may regress by more than 5%.
- **Correctness:** Existing active cases remain playable; no response may include answer keys, scoring rubric, ideal path, or treatment plan before attempt completion.
- **Data integrity:** An unreadable attempt file must be quarantined and logged; it must never be silently replaced by an empty store.
- **Availability:** Keep `TIP_AI_REPLICA_COUNT=1`; fail fast for a replica count other than one. Do not claim multi-replica support.
- **Security:** All admin case writes remain behind `cases.write`; malformed input returns 400, an incomplete activation returns 422, and server errors return no stored case content.
- **Maintainability:** One parser module and one persistence utility only. Avoid generic repositories, ORMs, new runtime dependencies, and duplicated validators.
- **Observability:** Persistence failures include a structured logger event and request ID where a route is involved; client copy remains concise and non-sensitive.
- **Verification:** Every task runs its focused Vitest file, then `npm test`, `npm run lint`, and `npm run build`. Commit and push after each completed task.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/admin/case-input.ts` | Parse untrusted create and patch JSON into typed, bounded `AdminVaka` updates. |
| `src/lib/admin/case-input.test.ts` | Behaviour tests for accepted and rejected input. |
| `src/app/api/admin/cases/route.ts` | Use create parser before storage and publication validation. |
| `src/app/api/admin/cases/[id]/route.ts` | Use patch parser before audit patches and mutation. |
| `src/lib/admin/json-store.ts` | Shared atomic JSON read/write, corruption quarantine, and single-writer lock primitives. |
| `src/lib/student/attempt-store.ts` | Use shared persistence primitives while retaining its public attempt functions and TTL. |
| `src/lib/student/attempt-store.test.ts` | Cover missing, corrupt, concurrent, expiry, and ownership behaviour. |
| `src/app/api/student/attempts/*.test.ts` | Verify public response shaping and mutation ownership through routes. |
| `src/lib/student/attempt-lab.ts` | Server-only adapter that resolves static/generated results for a student attempt. |
| `src/components/vaka/VakaWorkspace.tsx` | Consume a client-safe result callback; remove direct server-capable lab fallback and `@ts-ignore`. |
| `README.md` | Document single-replica JSON deployment, required environment variables, backup/restore, and validation commands. |

## Task 1: Add typed admin case request parsing

**Files:**
- Create: `src/lib/admin/case-input.ts`
- Create: `src/lib/admin/case-input.test.ts`
- Modify: `src/app/api/admin/cases/route.ts`
- Modify: `src/app/api/admin/cases/[id]/route.ts`

**Interfaces:**
- Produces `parseCreateCaseInput(raw: unknown): ParseResult<CreateCaseInput>`.
- Produces `parseCasePatchInput(raw: unknown): ParseResult<Partial<AdminVaka>>`.
- `ParseResult<T>` is `{ ok: true; value: T } | { ok: false; issues: InputIssue[] }`, where `InputIssue` is `{ field: string; message: string }`.

- [ ] **Step 1: Write failing parser tests**

```ts
it("rejects a patch with a non-array yasAraligi", () => {
  expect(parseCasePatchInput({ yasAraligi: "30,70" })).toEqual({
    ok: false,
    issues: [{ field: "yasAraligi", message: "[min, max] sayı çifti olmalı." }],
  });
});

it("keeps only typed, allowed patch fields", () => {
  const result = parseCasePatchInput({
    anaSikayet: "Göğüs ağrısı",
    durum: "taslak",
    unexpected: "discard",
  });
  expect(result).toEqual({ ok: true, value: { anaSikayet: "Göğüs ağrısı", durum: "taslak" } });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- --run src/lib/admin/case-input.test.ts`  
Expected: FAIL because `case-input.ts` does not exist.

- [ ] **Step 3: Implement the minimal parser**

```ts
export function parseCasePatchInput(raw: unknown): ParseResult<Partial<AdminVaka>> {
  if (!isRecord(raw)) return invalid("body", "JSON nesnesi gerekli.");
  const issues: InputIssue[] = [];
  const value: Partial<AdminVaka> = {};
  if (raw.durum !== undefined) value.durum = enumValue(raw.durum, ["taslak", "aktif", "arsiv"], "durum", issues);
  if (raw.yasAraligi !== undefined) value.yasAraligi = ageRange(raw.yasAraligi, issues);
  // Apply the same explicit helper pattern to every accepted field.
  return issues.length ? { ok: false, issues } : { ok: true, value };
}
```

Reject non-object nested fields, strings longer than their UI/storage bounds, invalid enum values, invalid numeric vitals, and non-string action/test keys. Keep the existing defaulting behaviour only in `parseCreateCaseInput`.

- [ ] **Step 4: Wire both routes**

```ts
const parsed = parseCasePatchInput(await req.json());
if (!parsed.ok) return NextResponse.json({ error: "Geçersiz vaka verisi.", issues: parsed.issues }, { status: 400 });
const updates = parsed.value;
```

Create audit patches only from `updates`, not from raw request JSON. Preserve the existing 422 publication response and RBAC checks.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/lib/admin/case-input.test.ts && npm test && npm run lint && npm run build`  
Commit: `git add src/lib/admin/case-input.ts src/lib/admin/case-input.test.ts src/app/api/admin/cases/route.ts src/app/api/admin/cases/[id]/route.ts && git commit -m "fix(api): validate admin case input"`

## Task 2: Make student attempt persistence reliable

**Files:**
- Create: `src/lib/admin/json-store.ts`
- Create: `src/lib/admin/json-store.test.ts`
- Modify: `src/lib/admin/store.ts`
- Modify: `src/lib/student/attempt-store.ts`
- Modify: `src/lib/student/attempt-store.test.ts`

**Interfaces:**
- Produces `readJsonOrRecover<T>(file, fallback, label): T`.
- Produces `writeJsonAtomic(file, value): void`.
- Produces `withJsonStoreLock<T>(fn: () => T | Promise<T>): Promise<T>`.
- `attempt-store` public functions become `Promise`-returning and retain their names: `startStudentAttempt`, `getActiveStudentAttempt`, `answerStudentAttempt`, `requestStudentAttemptTest`, `completeStudentAttempt`.

- [ ] **Step 1: Write failing persistence tests**

```ts
it("quarantines corrupt attempts instead of silently treating them as empty", async () => {
  writeFileSync(attemptsFile, "{ invalid", "utf8");
  await expect(getActiveStudentAttempt("student", "kardiyoloji")).rejects.toThrow("öğrenci oturumu");
  expect(readdirSync(dataDir).some((name) => name.includes("student-attempts.json.corrupt"))).toBe(true);
});

it("serializes two answers for the same attempt", async () => {
  await Promise.all([answerStudentAttempt(id, actor, "AGRI_YER"), answerStudentAttempt(id, actor, "AGRI_SURE")]);
  expect((await getActiveStudentAttempt(actor, "*")!).ilerleme.yanitlar).toHaveLength(2);
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run src/lib/student/attempt-store.test.ts`  
Expected: FAIL because corruption currently returns an empty store and concurrent calls are not serialized.

- [ ] **Step 3: Extract shared JSON primitives**

```ts
export function readJsonOrRecover<T>(file: string, fallback: T, label: string): T {
  try {
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch (error) {
    quarantineCorruptJson(file, error, label);
    throw new JsonStoreReadError(label, error);
  }
}
```

Move the existing fsync-based atomic writer from `admin/store.ts` unchanged. Reuse `adminDataDir()` so attempts receive the same `TIP_AI_REPLICA_COUNT=1` fail-fast behaviour.

- [ ] **Step 4: Convert attempt operations to locked async mutations**

```ts
export function answerStudentAttempt(id: string, actor: string, action: string) {
  return withJsonStoreLock(() => {
    const found = ownAttempt(id, actor);
    if (!found) return null;
    // mutate, atomic-write, then return the answer
  });
}
```

Update only API route call sites to `await` these functions. Map `JsonStoreReadError` to a logged 503 response; retain 404 for a genuinely missing attempt.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/lib/student/attempt-store.test.ts src/app/api/student/attempts/[id]/route.test.ts && npm test && npm run lint && npm run build`  
Commit: `git add src/lib/admin/json-store.ts src/lib/admin/json-store.test.ts src/lib/admin/store.ts src/lib/student/attempt-store.ts src/lib/student/attempt-store.test.ts src/app/api/student/attempts && git commit -m "fix(student): make attempts durable"`

## Task 3: Remove the client-to-server lab dependency

**Files:**
- Create: `src/lib/student/attempt-lab.ts`
- Create: `src/lib/student/attempt-lab.test.ts`
- Modify: `src/lib/student/attempt-store.ts`
- Modify: `src/components/vaka/VakaWorkspace.tsx`
- Modify: `next.config.mjs`

**Interfaces:**
- Produces `resolveAttemptTest(record: AttemptRecord, testKey: string): TestSonucu | null` from a server-only module.
- `VakaWorkspace` receives its existing `onTestRequest(testKey)` callback and never imports `getLabResult` or filesystem-adjacent modules.

- [ ] **Step 1: Write a failing server-only test**

```ts
it("returns a generated test result only when the attempt profile permits it", () => {
  expect(resolveAttemptTest(attempt, "KREATININ")).toMatchObject({ testKey: "KREATININ" });
  expect(resolveAttemptTest(attemptWithoutProfile, "UNKNOWN")).toBeNull();
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- --run src/lib/student/attempt-lab.test.ts`  
Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Move server-only resolution into the attempt layer**

```ts
export function resolveAttemptTest(record: AttemptRecord, testKey: string): TestSonucu | null {
  return record.vaka.statikTestler[testKey]
    || (record.vaka.profile ? getLabResult(testKey, record.vaka.profile, record.vaka.statikTestler) : null);
}
```

Use this resolver from `requestStudentAttemptTest`; the route remains the sole transport path for test data.

- [ ] **Step 4: Simplify the workspace**

Remove `getLabResult` and its fallback branch from `VakaWorkspace`. Type `statik` as `TestSonucu | null` and return the existing user-facing “test not found” message when `onTestRequest` yields `null`. Remove the `@ts-ignore` at line 289.

- [ ] **Step 5: Remove the workaround and verify**

Delete the `fs: false` webpack fallback only after a production build succeeds and `rg 'getLabResult|rule-engine-store' src/components/vaka/VakaWorkspace.tsx` returns no matches.

Run: `npm test -- --run src/lib/student/attempt-lab.test.ts src/lib/student/attempt-store.test.ts && npm test && npm run lint && npm run build`  
Commit: `git add src/lib/student/attempt-lab.ts src/lib/student/attempt-lab.test.ts src/lib/student/attempt-store.ts src/components/vaka/VakaWorkspace.tsx next.config.mjs && git commit -m "refactor(student): keep lab resolution server-side"`

## Task 4: Add route-level safety regression tests

**Files:**
- Create: `src/app/api/admin/cases/route.test.ts`
- Create: `src/app/api/admin/cases/[id]/route.test.ts`
- Modify: `vitest.config.mts` only if a route-test environment helper is required.

**Interfaces:**
- Route tests call exported `POST`/`PATCH` handlers with `NextRequest` and a signed admin session cookie.
- Tests isolate `data/admin` using the existing temp-directory convention in admin store tests.

- [ ] **Step 1: Write failing route tests**

```ts
it("returns 400 and field issues for a malformed privileged case patch", async () => {
  const response = await PATCH(request({ yasAraligi: "bad" }), params);
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({ issues: [{ field: "yasAraligi" }] });
});

it("returns 422 when a draft with missing expected answers is activated", async () => {
  const response = await PATCH(request({ durum: "aktif" }), params);
  expect(response.status).toBe(422);
  await expect(response.json()).resolves.toMatchObject({ validation: { errors: expect.any(Array) } });
});
```

- [ ] **Step 2: Run focused route tests and verify failure**

Run: `npm test -- --run src/app/api/admin/cases/route.test.ts src/app/api/admin/cases/[id]/route.test.ts`  
Expected: FAIL until Tasks 1–2 are complete.

- [ ] **Step 3: Add remaining behaviour cases**

Add tests for: 401 unauthenticated write, 403 role without `cases.write`, valid draft save, valid active publication, no raw answer key in student attempt start response, and 503 on a mocked attempt-store read failure.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run lint && npm run build`  
Commit: `git add src/app/api/admin/cases/route.test.ts src/app/api/admin/cases/[id]/route.test.ts vitest.config.mts && git commit -m "test(api): cover case safety boundaries"`

## Task 5: Consolidate CDM validation policies and document operations

**Files:**
- Create: `src/lib/cdm/validation-rules.ts`
- Modify: `src/lib/cdm/validate.ts`
- Modify: `src/lib/cdm/validate-report.ts`
- Modify: `src/lib/cdm/validate-report.test.ts`
- Create: `README.md`
- Modify: `.env.example`

**Interfaces:**
- Produces `validateCdmShape(raw: unknown): CdmValidationIssue[]` for import structural checks.
- Produces `validateCdmReadiness(doc: TipAiCdmDocument): ValidationIssue[]` for publication/report quality rules.
- Import routes retain their current issue response shape; report routes retain `VakaValidationResult`.

- [ ] **Step 1: Write policy-separation tests**

```ts
it("allows a syntactically valid draft through import validation", () => {
  expect(validateCdmShape(draft)).toEqual([]);
});

it("reports the same draft as not publication-ready", () => {
  expect(validateCdmReadiness(draft).map((issue) => issue.code)).toContain("MISSING_ANSWER_FOR_QUESTION");
});
```

- [ ] **Step 2: Extract only shared field rules**

Move shared helpers for record checks, age range, enum values, test keys, and non-empty text into `validation-rules.ts`. Keep import canonicalization/remapping and report aggregation in their existing modules.

- [ ] **Step 3: Create the operations runbook**

Document these exact facts:

```md
Runtime storage: JSON files under /app/data/admin.
Deployment limit: TIP_AI_REPLICA_COUNT=1.
Persistence requirement: mount /app/data as a durable volume.
Required production variables: ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET.
Checks: npm test, npm run lint, npm run build, npm run validate:vakalar.
```

Remove the inaccurate Prisma/SQLite `DATABASE_URL` section from `.env.example` unless an actual database adapter is introduced in the same change.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- --run src/lib/cdm/validate-report.test.ts && npm test && npm run lint && npm run build`  
Commit: `git add src/lib/cdm/validation-rules.ts src/lib/cdm/validate.ts src/lib/cdm/validate-report.ts src/lib/cdm/validate-report.test.ts README.md .env.example && git commit -m "refactor(cdm): separate validation policies"`

## Final acceptance gate

- [ ] Run `npm test`, `npm run lint`, and `npm run build` successfully.
- [ ] Measure the agreed `[XYZ]` performance metric before and after; verify P50 and P95 are within the stated target or the temporary 5% no-regression threshold.
- [ ] In a production-like single-replica container with a mounted `/app/data`, verify a student can resume an attempt after a process restart.
- [ ] Verify malformed admin input returns 400, incomplete activation returns 422, and unauthorized write returns 401/403.
- [ ] Run `npm audit --omit=dev --audit-level=high` in networked CI and record the result in the PR.
- [ ] Commit the final verification-only changes, push each task commit, and attach the metrics to the release notes.
