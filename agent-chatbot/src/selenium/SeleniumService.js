import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { config } from "../config.js";

/**
 * SeleniumService runs browser automation with strict isolation:
 * - NEVER reuses a driver across sessions
 * - Uses a unique user-data-dir per invocation
 * - Always quits driver and deletes profile dir
 *
 * NOTE: Selectors/flows are placeholders; you must wire to your LMS UI if needed.
 * The preferred execution path is direct backend API calls.
 */
export class SeleniumService {
  constructor({ webBase = config.LMS_WEB_BASE } = {}) {
    this.webBase = webBase;
  }

  async loadSelectors() {
    const filePath = path.join(process.cwd(), "selenium", "selectors.json");
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  }

  async runIsolated(sessionId, fn) {
    const selectors = await this.loadSelectors();
    const profileDir = await this._createProfileDir(sessionId);
    const driver = await this._buildChrome(profileDir);
    try {
      return await fn(driver, selectors);
    } finally {
      try {
        await driver.quit();
      } catch {
        // ignore
      }
      await this._cleanupProfileDir(profileDir);
    }
  }

  async login({ sessionId, role, identifier, password }) {
    return this.runIsolated(sessionId, async (driver, selectors) => {
      const cfg = selectors?.login?.[role];
      if (!cfg?.path) return { ok: false, error: "Missing selectors.login config" };

      await this._go(driver, `${this.webBase}${cfg.path}`, selectors);

      await this._type(driver, cfg.identifier, identifier, selectors);
      await this._type(driver, cfg.password, password, selectors);
      await this._click(driver, cfg.submit, selectors);

      // success heuristic: URL changes away from login page
      await driver.wait(async () => {
        const url = await driver.getCurrentUrl();
        return !url.includes(cfg.path);
      }, selectors?.timeouts_ms?.page_load || 30000).catch(() => null);

      return { ok: true, data: { role } };
    });
  }

  async registerStudent({ sessionId, roll_no, full_name, email, password }) {
    return this.runIsolated(sessionId, async (driver, selectors) => {
      const cfg = selectors?.register;
      if (!cfg?.path) return { ok: false, error: "Missing selectors.register config" };

      await this._go(driver, `${this.webBase}${cfg.path}`, selectors);
      await this._type(driver, cfg.roll_no, roll_no, selectors);
      await this._type(driver, cfg.full_name, full_name, selectors);
      await this._type(driver, cfg.email, email, selectors);
      await this._type(driver, cfg.password, password, selectors);
      await this._click(driver, cfg.submit, selectors);

      // success heuristic: navigates to /app
      await driver.wait(async () => {
        const url = await driver.getCurrentUrl();
        return url.includes("/app");
      }, selectors?.timeouts_ms?.page_load || 30000).catch(() => null);

      return { ok: true, data: { roll_no, email } };
    });
  }

  async enrollCourse({ sessionId, semester, course_code }) {
    return this.runIsolated(sessionId, async (driver, selectors) => {
      const cfg = selectors?.student?.registration;
      if (!cfg?.path) return { ok: false, error: "Missing selectors.student.registration config" };

      await this._go(driver, `${this.webBase}${cfg.path}`, selectors);
      if (cfg.semester_input && semester) {
        await this._clearAndType(driver, cfg.semester_input, semester, selectors);
      }

      // Find the row containing course_code and click its Register button
      const rows = await driver.findElements(By.css(cfg.available_table_rows));
      for (const row of rows) {
        const text = await row.getText();
        if (text.includes(course_code)) {
          const btn = await row.findElement(By.css(cfg.register_button_in_row));
          await btn.click();
          return { ok: true, data: { semester, course_code } };
        }
      }
      return { ok: false, error: "Course row not found in available courses table (selectors may need adjustment)." };
    });
  }

  async dropCourse({ sessionId, semester, course_code }) {
    return this.runIsolated(sessionId, async (driver, selectors) => {
      const cfg = selectors?.student?.registration;
      if (!cfg?.path) return { ok: false, error: "Missing selectors.student.registration config" };

      await this._go(driver, `${this.webBase}${cfg.path}`, selectors);
      if (cfg.semester_input && semester) {
        await this._clearAndType(driver, cfg.semester_input, semester, selectors);
      }

      const rows = await driver.findElements(By.css(cfg.my_table_rows));
      for (const row of rows) {
        const text = await row.getText();
        if (text.includes(course_code)) {
          const btn = await row.findElement(By.css(cfg.unregister_button_in_row));
          await btn.click();
          return { ok: true, data: { semester, course_code } };
        }
      }
      return { ok: false, error: "Course row not found in registered courses table (selectors may need adjustment)." };
    });
  }

  async viewMarks({ sessionId, semester, course_code }) {
    return this.runIsolated(sessionId, async (driver, selectors) => {
      const cfg = selectors?.student?.marks;
      if (!cfg?.path) return { ok: false, error: "Missing selectors.student.marks config" };

      await this._go(driver, `${this.webBase}${cfg.path}`, selectors);
      // Use UI select if present; the UI selection is course_code|semester
      if (cfg.course_select) {
        const sel = await driver.findElement(By.css(cfg.course_select));
        await sel.sendKeys(`${course_code}|${semester}`);
      }
      // Extract page text as proof-of-work (in real build: parse structured cards/tables)
      const bodyText = await driver.findElement(By.css("body")).getText();
      return { ok: true, data: { extracted: bodyText.slice(0, 2000) } };
    });
  }

  async viewAttendance({ sessionId, semester, course_code }) {
    return this.runIsolated(sessionId, async (driver, selectors) => {
      const cfg = selectors?.student?.attendance;
      if (!cfg?.path) return { ok: false, error: "Missing selectors.student.attendance config" };

      await this._go(driver, `${this.webBase}${cfg.path}`, selectors);
      if (cfg.course_select) {
        const sel = await driver.findElement(By.css(cfg.course_select));
        await sel.sendKeys(`${course_code}|${semester}`);
      }
      const bodyText = await driver.findElement(By.css("body")).getText();
      return { ok: true, data: { extracted: bodyText.slice(0, 2000) } };
    });
  }

  async _buildChrome(profileDir) {
    const options = new chrome.Options();
    options.addArguments(`--user-data-dir=${profileDir}`);
    options.addArguments("--no-first-run");
    options.addArguments("--no-default-browser-check");
    // Required: headless, auto-close, deterministic
    options.addArguments("--headless=new");
    options.addArguments("--disable-gpu");
    options.addArguments("--window-size=1280,900");
    options.addArguments("--disable-dev-shm-usage");
    return new Builder().forBrowser("chrome").setChromeOptions(options).build();
  }

  async _createProfileDir(sessionId) {
    const base = path.join(os.tmpdir(), "lms-agent-selenium");
    const dir = path.join(base, `${sessionId}-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  async _cleanupProfileDir(dir) {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  async _go(driver, url, selectors) {
    await driver.get(url);
    await driver.wait(until.elementLocated(By.css("body")), selectors?.timeouts_ms?.element || 15000);
  }

  async _type(driver, css, value, selectors) {
    const el = await driver.wait(until.elementLocated(By.css(css)), selectors?.timeouts_ms?.element || 15000);
    await el.sendKeys(String(value ?? ""));
  }

  async _clearAndType(driver, css, value, selectors) {
    const el = await driver.wait(until.elementLocated(By.css(css)), selectors?.timeouts_ms?.element || 15000);
    await el.clear().catch(() => null);
    await el.sendKeys(String(value ?? ""));
  }

  async _click(driver, css, selectors) {
    const el = await driver.wait(until.elementLocated(By.css(css)), selectors?.timeouts_ms?.element || 15000);
    await driver.wait(until.elementIsVisible(el), selectors?.timeouts_ms?.element || 15000);
    await el.click();
  }
}

