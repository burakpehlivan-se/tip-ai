import { describe, expect, it } from "vitest";
import { isAuthMigrationReady, type AuthMigrationReadiness } from "./migration-readiness";

const complete: AuthMigrationReadiness = {
  migrationJournal: true,
  migrationApplied: true,
  usersTable: true,
  auditTable: true,
  sessionsTable: true,
  learningAttemptsTable: true,
  cohortsTable: true,
  cohortMembershipsTable: true,
  cohortAssignmentsTable: true,
};

describe("auth migration readiness", () => {
  it("yalnızca migration defteri, uygulanmış migration ve auth tabloları varsa hazırdır", () => {
    expect(isAuthMigrationReady(complete)).toBe(true);
  });

  it("eksik bir migration işaretinde hazır kabul etmez", () => {
    expect(isAuthMigrationReady({ ...complete, migrationApplied: false })).toBe(false);
    expect(isAuthMigrationReady({ ...complete, usersTable: false })).toBe(false);
    expect(isAuthMigrationReady({ ...complete, sessionsTable: false })).toBe(false);
    expect(isAuthMigrationReady({ ...complete, learningAttemptsTable: false })).toBe(false);
    expect(isAuthMigrationReady({ ...complete, cohortsTable: false })).toBe(false);
    expect(isAuthMigrationReady({ ...complete, cohortAssignmentsTable: false })).toBe(false);
  });
});
