import { ApiExecutor } from "../lms/ApiExecutor.js";
import { SeleniumService } from "../selenium/SeleniumService.js";

/**
 * Chooses execution backend (API vs Selenium) and enforces capability constraints.
 */
export class ActionRouter {
  constructor({ apiExecutor = new ApiExecutor(), selenium = new SeleniumService() } = {}) {
    this.apiExecutor = apiExecutor;
    this.selenium = selenium;
  }

  /**
   * Hybrid execution:
   * 1) try API
   * 2) if fails and fallbackAllowed => try Selenium
   * Returns unified format:
   * { ok, mode:"api"|"selenium", status?, data?, error?, attempts:[...] }
   */
  async execute({ intentSpec, intentName, parameters, sessionState, prefer = "api", fallbackAllowed = true }) {
    console.log(`[ActionRouter] Executing intent: ${intentName} (prefer: ${prefer}, fallbackAllowed: ${fallbackAllowed})`);
    const attempts = [];

    const apiFirst = prefer !== "selenium";
    const order = apiFirst ? ["api", "selenium"] : ["selenium", "api"];

    for (const mode of order) {
      if (mode === "selenium") {
        if (!fallbackAllowed) {
          console.log("[ActionRouter] Selenium mode skipped (fallback not allowed).");
          continue;
        }
        if (!this._isSeleniumImplemented(intentName)) {
          console.log(`[ActionRouter] Selenium mode skipped (not implemented for intent: ${intentName}).`);
          continue;
        }
      }
      console.log(`[ActionRouter] Trying mode: ${mode}...`);
      const r = await this._executeOne({ mode, intentSpec, intentName, parameters, sessionState });
      attempts.push({ mode, ok: r.ok, status: r.status, error: r.error });
      
      if (r.ok) {
        console.log(`[ActionRouter] Success with mode: ${mode}`);
        return { ...r, mode, attempts };
      }
      console.warn(`[ActionRouter] Failed with mode: ${mode}. Error: ${r.error}`);
    }

    const last = attempts[attempts.length - 1] || {};
    console.error("[ActionRouter] All execution modes failed.");
    return { ok: false, mode: last.mode || prefer, error: last.error || "Action failed", attempts };
  }

  _isSeleniumImplemented(intentName) {
    const implemented = [
      "student_login",
      "teacher_login",
      "student_register",
      "student_register_course",
      "student_unregister_course",
      "student_view_marks",
      "student_view_attendance",
    ];
    return implemented.includes(intentName);
  }

  async _executeOne({ mode, intentSpec, intentName, parameters, sessionState }) {
    if (mode === "api") {
      return await this.apiExecutor.execute({ intentSpec, parameters, sessionState });
    }

    // Selenium mappings for high-value flows
    if (intentName === "student_login") {
      return await this.selenium.login({
        sessionId: sessionState.sessionId,
        role: "student",
        identifier: parameters.identifier || parameters.roll_no || parameters.email,
        password: parameters.password,
      });
    }
    if (intentName === "teacher_login") {
      return await this.selenium.login({
        sessionId: sessionState.sessionId,
        role: "teacher",
        identifier: parameters.identifier || parameters.username || parameters.email,
        password: parameters.password,
      });
    }
    if (intentName === "student_register") {
      return await this.selenium.registerStudent({ sessionId: sessionState.sessionId, ...parameters });
    }
    if (intentName === "student_register_course") {
      return await this.selenium.enrollCourse({
        sessionId: sessionState.sessionId,
        semester: parameters.semester,
        course_code: parameters.course_code,
      });
    }
    if (intentName === "student_unregister_course") {
      return await this.selenium.dropCourse({
        sessionId: sessionState.sessionId,
        semester: parameters.semester,
        course_code: parameters.course_code,
      });
    }
    if (intentName === "student_view_marks") {
      return await this.selenium.viewMarks({
        sessionId: sessionState.sessionId,
        semester: parameters.semester,
        course_code: parameters.course_code,
      });
    }
    if (intentName === "student_view_attendance") {
      return await this.selenium.viewAttendance({
        sessionId: sessionState.sessionId,
        semester: parameters.semester,
        course_code: parameters.course_code,
      });
    }

    return { ok: false, error: "Selenium execution not implemented for this intent." };
  }
}

