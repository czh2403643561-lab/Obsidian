import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const projectRoot = process.cwd();
const config = JSON.parse(await readFile(path.join(projectRoot, ".visual-reference.local.json"), "utf8"));
const outputDir = path.join(projectRoot, "artifacts", "visual");
await mkdir(outputDir, { recursive: true });

const lightFill = [248, 249, 249, 255];
const readPng = async (filePath) => PNG.sync.read(await readFile(filePath));
const writePng = async (filePath, png) => writeFile(filePath, PNG.sync.write(png));
const canvas = (width, height) => {
  const png = new PNG({ width, height });
  for (let index = 0; index < png.data.length; index += 4) png.data.set(lightFill, index);
  return png;
};
const copyImage = (source, target) => {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (y * source.width + x) * 4;
      const targetIndex = (y * target.width + x) * 4;
      target.data[targetIndex] = source.data[sourceIndex];
      target.data[targetIndex + 1] = source.data[sourceIndex + 1];
      target.data[targetIndex + 2] = source.data[sourceIndex + 2];
      target.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }
};
const crop = (source, clip) => {
  const result = new PNG({ width: clip.width, height: clip.height });
  for (let y = 0; y < clip.height; y += 1) {
    for (let x = 0; x < clip.width; x += 1) {
      const sourceIndex = ((clip.y + y) * source.width + clip.x + x) * 4;
      const targetIndex = (y * clip.width + x) * 4;
      result.data[targetIndex] = source.data[sourceIndex];
      result.data[targetIndex + 1] = source.data[sourceIndex + 1];
      result.data[targetIndex + 2] = source.data[sourceIndex + 2];
      result.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }
  return result;
};
const overlay = (actual, reference) => {
  const result = canvas(actual.width, actual.height);
  const width = Math.min(actual.width, reference.width);
  const height = Math.min(actual.height, reference.height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * result.width + x) * 4;
      result.data[index] = Math.round((actual.data[index] + reference.data[index]) / 2);
      result.data[index + 1] = Math.round((actual.data[index + 1] + reference.data[index + 1]) / 2);
      result.data[index + 2] = Math.round((actual.data[index + 2] + reference.data[index + 2]) / 2);
      result.data[index + 3] = 255;
    }
  }
  return result;
};

const report = [];
for (const item of config.pages) {
  const actual = await readPng(path.join(outputDir, `${item.name}-actual.png`));
  const referenceFull = await readPng(item.reference);
  const reference = crop(referenceFull, item.referenceClip);
  const width = Math.max(actual.width, reference.width);
  const height = Math.max(actual.height, reference.height);
  const actualCanvas = canvas(width, height);
  const referenceCanvas = canvas(width, height);
  copyImage(actual, actualCanvas);
  copyImage(reference, referenceCanvas);
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(actualCanvas.data, referenceCanvas.data, diff.data, width, height, { threshold: 0.1, includeAA: false });
  await writePng(path.join(outputDir, `${item.name}-reference.png`), reference);
  await writePng(path.join(outputDir, `${item.name}-diff.png`), diff);
  await writePng(path.join(outputDir, `${item.name}-overlay.png`), overlay(actualCanvas, referenceCanvas));
  report.push({
    name: item.name,
    actual: { width: actual.width, height: actual.height },
    reference: { width: reference.width, height: reference.height },
    widthDelta: actual.width - reference.width,
    heightDelta: actual.height - reference.height,
    diffPixels,
    diffRatio: Number((diffPixels / (width * height)).toFixed(4)),
  });
}

await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify({ run: process.env.VISUAL_RUN_LABEL ?? "current", pages: report }, null, 2)}\n`);
await writeFile(path.join(outputDir, "measurements.json"), `${JSON.stringify({
  source: "UK referenceClip plus final UK visual tokens",
  viewport: config.viewport,
  pages: config.pages.map((item) => ({
    name: item.name,
    referenceClip: item.referenceClip,
    shellWidth: item.referenceClip.width,
    headerHeight: 70,
    noticeHeight: 38,
    sidebarWidth: 210,
    sidebarGap: 14,
    panelGap: 14,
  })),
}, null, 2)}\n`);
const lines = [`run: ${process.env.VISUAL_RUN_LABEL ?? "current"}`, ""];
for (const item of report) {
  lines.push(`${item.name}:`);
  lines.push(`  actual ${item.actual.width}x${item.actual.height}`);
  lines.push(`  reference ${item.reference.width}x${item.reference.height}`);
  lines.push(`  width delta ${item.widthDelta >= 0 ? "+" : ""}${item.widthDelta}`);
  lines.push(`  height delta ${item.heightDelta >= 0 ? "+" : ""}${item.heightDelta}`);
  lines.push(`  diff ${item.diffPixels} pixels (${(item.diffRatio * 100).toFixed(2)}%)`);
  lines.push("");
}
await writeFile(path.join(outputDir, "report.txt"), `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
