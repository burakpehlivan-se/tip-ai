import { describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "@/lib/admin/auth";
import { STUDENT_SESSION_COOKIE } from "@/lib/student/auth";

describe("oturum API cookie sözleşmesi", () => {
  it("personel ve öğrenci cookie adlarını birbirinden ayırır", () => {
    expect(SESSION_COOKIE).toBe("tip_ai_admin_session");
    expect(STUDENT_SESSION_COOKIE).toBe("tip_ai_student_session");
    expect(SESSION_COOKIE).not.toBe(STUDENT_SESSION_COOKIE);
  });
});
