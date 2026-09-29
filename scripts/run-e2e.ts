import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildApp } from '../apps/api/src/app';
import { createDbClient } from '../apps/api/src/db/client';
import { runMigrations } from '../apps/api/src/db/migrate';
import { seedDatabase } from '../apps/api/src/db/seed';
import { getEnv } from '../apps/api/src/config/env';

const TEST_DB_PATH = 'data/e2e-test.db';
const TEST_PORT = 3844;
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots');

function cleanupDb() {
  const files = [
    TEST_DB_PATH,
    `${TEST_DB_PATH}-wal`,
    `${TEST_DB_PATH}-shm`,
  ];
  for (const f of files) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
  }
}

async function main() {
  console.log('=== [E2E] Starting Playwright 390x844 End-to-End Suite ===');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // 1. Setup isolated database
  cleanupDb();
  process.env.DATABASE_URL = TEST_DB_PATH;
  process.env.PORT = String(TEST_PORT);
  process.env.NODE_ENV = 'test';
  process.env.MOCK_AI = 'true';
  process.env.CORS_ORIGIN = `http://localhost:${TEST_PORT},http://127.0.0.1:${TEST_PORT}`;
  delete process.env.APP_PASSPHRASE; // Ensure no user is pre-created

  console.log('[E2E] Initializing clean SQLite database...');
  const db = createDbClient(TEST_DB_PATH);
  runMigrations(db);

  console.log('[E2E] Seeding reference topics...');
  await seedDatabase(db);

  // 2. Start Fastify server
  console.log(`[E2E] Starting Fastify server on port ${TEST_PORT}...`);
  const env = getEnv();
  const app = buildApp({ env, db, logger: false });
  await app.listen({ port: TEST_PORT, host: '127.0.0.1' });
  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;
  console.log(`[E2E] Server ready at ${baseUrl}`);

  // 3. Launch Chromium at 390x844 (Mobile Viewport)
  console.log('[E2E] Launching Chromium (390x844 mobile viewport)...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();

  // Auto-accept window.confirm dialogs (e.g. for skip step, exit session)
  page.on('dialog', async (dialog) => {
    console.log(`[E2E Dialog] Auto-accepting "${dialog.message().slice(0, 50)}..."`);
    await dialog.accept();
  });

  try {
    // -------------------------------------------------------------
    // SCENARIO 1: First-Run Setup Screen
    // -------------------------------------------------------------
    console.log('[E2E] Scenario 1: First-run setup...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=First-Run Setup', { timeout: 10000 });
    await page.waitForSelector('button:has-text("Create Master Passphrase")');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-setup-screen.png'),
      fullPage: false,
    });
    console.log('  -> Saved 01-setup-screen.png');

    // -------------------------------------------------------------
    // SCENARIO 2: Complete Setup & Authenticate to Coach Dashboard
    // -------------------------------------------------------------
    console.log('[E2E] Scenario 2: Completing master passphrase setup...');
    await page.fill('input#passphrase', 'correct-horse-battery-staple-2026');
    await page.click('button:has-text("Create Master Passphrase")');

    await page.waitForSelector('text=Interactive AI Socratic Coach', { timeout: 15000 });
    await page.waitForSelector('text=Ready to sharpen your architectural thinking?');
    await page.waitForTimeout(600);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-coach-dashboard.png'),
      fullPage: false,
    });
    console.log('  -> Saved 02-coach-dashboard.png');

    // -------------------------------------------------------------
    // SCENARIO 3: Topics Curriculum Catalog
    // -------------------------------------------------------------
    console.log('[E2E] Scenario 3: Navigating to curriculum catalog...');
    await page.click('button[role="tab"]:has-text("Topics")');
    await page.waitForSelector('text=Curriculum Topics', { timeout: 10000 });
    await page.waitForSelector('h3:has-text("Email + Password Authentication")');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-topics-catalog.png'),
      fullPage: false,
    });
    console.log('  -> Saved 03-topics-catalog.png');

    // -------------------------------------------------------------
    // SCENARIO 4: Topic Detail Modal
    // -------------------------------------------------------------
    console.log('[E2E] Scenario 4: Opening topic detail modal...');
    await page.click('h3:has-text("Email + Password Authentication")');
    await page.waitForSelector('button:has-text("Start Practice")', { timeout: 10000 });
    await page.waitForSelector('text=Experience Level');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-topic-modal.png'),
      fullPage: false,
    });
    console.log('  -> Saved 04-topic-modal.png');

    // -------------------------------------------------------------
    // SCENARIO 5: Active Session Initial Step (Step 1 of 4)
    // -------------------------------------------------------------
    console.log('[E2E] Scenario 5: Starting active practice session...');
    await page.click('button:has-text("Start Practice")');

    await page.waitForSelector('text=Step 1 of 4', { timeout: 15000 });
    await page.waitForSelector('textarea');
    await page.waitForSelector('button:has-text("2/2 Hints")');
    await page.waitForTimeout(600);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-session-step-1.png'),
      fullPage: false,
    });
    console.log('  -> Saved 05-session-step-1.png');

    // -------------------------------------------------------------
    // SCENARIO 6: Hint Ladder Level 1
    // -------------------------------------------------------------
    console.log('[E2E] Scenario 6: Requesting Hint 1 (Level 1)...');
    await page.click('button:has-text("2/2 Hints")');
    await page.waitForSelector('text=💡 Hint (Level 1):', { timeout: 10000 });
    await page.waitForSelector('button:has-text("1/2 Hints")');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-hint-1-active.png'),
      fullPage: false,
    });
    console.log('  -> Saved 06-hint-1-active.png');

    // -------------------------------------------------------------
    // SCENARIO 7: Hint Ladder Level 2 & 2-Hint Hard Cap Enforcement
    // -------------------------------------------------------------
    console.log('[E2E] Scenario 7: Requesting Hint 2 (Level 2 - Cap reached)...');
    await page.click('button:has-text("1/2 Hints")');
    await page.waitForSelector('text=💡 Hint (Level 2):', { timeout: 10000 });
    await page.waitForSelector('button[disabled]:has-text("0/2 Hints")');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '07-hint-2-active.png'),
      fullPage: false,
    });
    console.log('  -> Saved 07-hint-2-active.png');

    // -------------------------------------------------------------
    // SCENARIO 8: Submit Answer & Receive Evaluated Stream
    // -------------------------------------------------------------
    console.log('[E2E] Scenario 8: Submitting architectural answer...');
    const answer =
      'We use Argon2id with 19 MiB memory cost, 2 iterations, and parallelism 1. Each password hash incorporates a 16-byte random salt. Comparison is timing-safe to eliminate side channels. Authentication sets an HttpOnly Secure session cookie with a 256-bit token.';
    await page.fill('textarea', answer);
    await page.click('button[title="Submit Answer"]');

    // Wait for evaluated grade to appear in transcript
    await page.waitForSelector('text=Independence:', { timeout: 15000 });
    await page.waitForTimeout(800);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '08-answer-evaluated.png'),
      fullPage: false,
    });
    console.log('  -> Saved 08-answer-evaluated.png');

    // -------------------------------------------------------------
    // SCENARIO 9: Step Skip & Reference Model Answer
    // -------------------------------------------------------------
    console.log('[E2E] Scenario 9: Skipping step...');
    await page.click('button:has-text("Skip Step")');
    await page.waitForSelector('text=⏩ Step Skipped (Independence: 0/4)', { timeout: 10000 });
    await page.waitForSelector('text=Model Answer:');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '09-step-skipped-model-answer.png'),
      fullPage: false,
    });
    console.log('  -> Saved 09-step-skipped-model-answer.png');

    // -------------------------------------------------------------
    // SCENARIO 10: Settings & AI Providers Configuration
    // -------------------------------------------------------------
    console.log('[E2E] Scenario 10: Navigating to Settings view...');
    await page.click('button[title="Exit Session"]');
    await page.waitForSelector('text=Curriculum Topics', { timeout: 10000 });

    await page.click('button[role="tab"]:has-text("Settings")');
    await page.waitForSelector('text=AI Provider Routing & Keys', { timeout: 10000 });
    await page.waitForSelector('text=Google Gemini');
    await page.waitForSelector('text=Groq');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '10-settings-providers.png'),
      fullPage: false,
    });
    console.log('  -> Saved 10-settings-providers.png');

    // -------------------------------------------------------------
    // SCENARIO 11: Progress & Skill Radar Dashboard
    // -------------------------------------------------------------
    console.log('[E2E] Scenario 11: Navigating to Progress dashboard...');
    await page.click('button[role="tab"]:has-text("Progress")');
    await page.waitForSelector('text=Competency Progress', { timeout: 10000 });
    await page.waitForTimeout(600);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '11-progress-dashboard.png'),
      fullPage: false,
    });
    console.log('  -> Saved 11-progress-dashboard.png');

    // -------------------------------------------------------------
    // SCENARIO 12: Offline Mode Simulation & Warning Banner
    // -------------------------------------------------------------
    console.log('[E2E] Scenario 12: Emulating offline state...');
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForSelector('text=You are currently offline', { timeout: 10000 });
    await page.waitForTimeout(400);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '12-offline-mode.png'),
      fullPage: false,
    });
    console.log('  -> Saved 12-offline-mode.png');

    console.log('=== [E2E] All 12 scenarios successfully completed! ===');
  } finally {
    await browser.close();
    await app.close();
    cleanupDb();
  }
}

main().catch((err) => {
  console.error('[E2E] Suite execution error:', err);
  process.exit(1);
});
