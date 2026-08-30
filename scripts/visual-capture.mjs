import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, ".visual-reference.local.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const outputDir = path.join(projectRoot, "artifacts", "visual");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: config.viewport.width, height: config.viewport.height },
  deviceScaleFactor: config.viewport.deviceScaleFactor,
});
const page = await context.newPage();
await page.goto(config.baseUrl, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "经营分析", exact: true }).click();
await page.waitForTimeout(220);
await page.locator(".uk-import-input").setInputFiles(config.importFiles);
await page.waitForTimeout(1200);
const closeManager = page.getByRole("button", { name: "关闭数据管理", exact: true });
if (await closeManager.count()) await closeManager.click();

for (const item of config.pages) {
  await page.getByRole("button", { name: item.section, exact: true }).click();
  if (item.sidebar) await page.locator(".uk-secondary-sidebar").getByRole("button", { name: item.sidebar, exact: true }).click();
  await page.waitForTimeout(220);
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), item.scrollY ?? 0);
  await page.waitForTimeout(120);
  const root = page.locator(config.rootSelector);
  const rect = await root.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));
  const width = Math.min(config.viewport.width - x, Math.round(rect.width));
  const height = Math.min(config.viewport.height - y, Math.round(rect.height));
  await page.screenshot({ path: path.join(outputDir, `${item.name}-actual.png`), clip: { x, y, width, height } });
  console.log(`${item.name}: ${width}x${height}`);
}

await browser.close();
