#!/usr/bin/env node
/**
 * Screenshot harness for visual review.
 *
 *   node scripts/screenshot.mjs <path> [options]
 *
 * Options
 *   --out <file>          Output png (default: /tmp/shots/<slug>-<theme>-<w>.png)
 *   --theme dark|light    Theme to force (default: dark)
 *   --width <px>          Viewport width (default: 1600)
 *   --height <px>         Viewport height (default: 1000)
 *   --full                Capture the full scrollable page
 *   --wait <ms>           Extra settle time after load (default: 2200)
 *   --base <url>          Base URL (default: http://localhost:3000)
 *   --click <selector>    Click a selector before capturing (repeatable)
 *   --hover <selector>    Hover a selector before capturing
 *   --eval <js>           Run JS in the page before capturing
 *   --clip <sel>          Screenshot only that element
 *   --scale <n>           deviceScaleFactor (default: 2)
 *
 * Prints a JSON summary including any console errors and failed requests,
 * which makes it easy to spot runtime problems while reviewing visuals.
 */

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import puppeteer from "puppeteer";

const argv = process.argv.slice(2);
if (!argv.length || argv[0].startsWith("--")) {
  console.error("Usage: node scripts/screenshot.mjs <path> [options]");
  process.exit(1);
}

const targetPath = argv[0];
const flags = {};
const repeatable = { click: [], hover: [] };

for (let i = 1; i < argv.length; i += 1) {
  const arg = argv[i];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  if (key === "full") {
    flags.full = true;
    continue;
  }
  const value = argv[i + 1];
  i += 1;
  if (key in repeatable) repeatable[key].push(value);
  else flags[key] = value;
}

const base = flags.base ?? "http://localhost:3000";
const theme = flags.theme ?? "dark";
const width = Number(flags.width ?? 1600);
const height = Number(flags.height ?? 1000);
const waitMs = Number(flags.wait ?? 2200);
const scale = Number(flags.scale ?? 2);

const slug = targetPath.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "root";
const out = resolve(flags.out ?? `/tmp/shots/${slug}-${theme}-${width}.png`);
mkdirSync(dirname(out), { recursive: true });

const browser = await puppeteer.launch({
  headless: "new",
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--font-render-hinting=none",
    "--force-color-profile=srgb",
    "--hide-scrollbars",
  ],
});

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];

try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: scale });

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 400));
    if (msg.type() === "warning" && /hydrat|key|prop/i.test(msg.text())) {
      consoleErrors.push(`[warn] ${msg.text().slice(0, 300)}`);
    }
  });
  page.on("pageerror", (err) => pageErrors.push(String(err.message).slice(0, 400)));
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (url.startsWith("data:")) return;
    failedRequests.push(`${req.failure()?.errorText ?? "failed"} ${url.slice(0, 160)}`);
  });

  // Seed the theme before the app boots so there is no flash.
  await page.evaluateOnNewDocument((t) => {
    try {
      localStorage.setItem("flawless.theme", t);
    } catch {
      /* ignore */
    }
  }, theme);

  await page.goto(`${base}${targetPath}`, {
    waitUntil: "networkidle2",
    timeout: 60_000,
  });

  await new Promise((r) => setTimeout(r, waitMs));

  for (const selector of repeatable.click) {
    try {
      await page.waitForSelector(selector, { timeout: 8000 });
      await page.click(selector);
      await new Promise((r) => setTimeout(r, 900));
    } catch {
      consoleErrors.push(`[harness] could not click ${selector}`);
    }
  }

  for (const selector of repeatable.hover) {
    try {
      await page.hover(selector);
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      consoleErrors.push(`[harness] could not hover ${selector}`);
    }
  }

  if (flags.eval) {
    await page.evaluate(flags.eval);
    await new Promise((r) => setTimeout(r, 700));
  }

  // Freeze animations so screenshots are deterministic.
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;}",
  });
  await new Promise((r) => setTimeout(r, 250));

  if (flags.clip) {
    const el = await page.$(flags.clip);
    if (!el) throw new Error(`clip selector not found: ${flags.clip}`);
    await el.screenshot({ path: out });
  } else {
    await page.screenshot({ path: out, fullPage: Boolean(flags.full) });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        screenshot: out,
        url: `${base}${targetPath}`,
        theme,
        viewport: `${width}x${height}`,
        consoleErrors: [...new Set(consoleErrors)].slice(0, 25),
        pageErrors: [...new Set(pageErrors)].slice(0, 25),
        failedRequests: [...new Set(failedRequests)].slice(0, 25),
      },
      null,
      2
    )
  );
} catch (err) {
  console.log(
    JSON.stringify(
      { ok: false, error: String(err.message), consoleErrors, pageErrors, failedRequests },
      null,
      2
    )
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
