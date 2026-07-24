import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "public/brand/logo-source.png");
const outDir = path.join(root, "public/brand");
const appDir = path.join(root, "src/app");

async function toTransparent(inputPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // Keep pink and white; kill near-black background
    if (lum < 22 && r < 40 && g < 40 && b < 40) {
      data[i + 3] = 0;
    } else if (lum < 45 && r < 55 && g < 55 && b < 55) {
      data[i + 3] = Math.round(((lum - 22) / 23) * 255);
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

function rowOccupancy(data, width, height) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    let count = 0;
    let pink = 0;
    let white = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 40) continue;
      count++;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 180 && g < 120 && b > 80) pink++;
      else if (r > 200 && g > 200 && b > 200) white++;
    }
    rows.push({ y, count, pink, white, ratio: count / width });
  }
  return rows;
}

function findContentBands(rows) {
  const active = rows.filter((r) => r.ratio > 0.01);
  const first = active[0]?.y ?? 0;
  const last = active[active.length - 1]?.y ?? rows.length - 1;

  // Find gaps (low occupancy) between content blocks
  const gaps = [];
  let inGap = false;
  let gapStart = 0;
  for (let y = first; y <= last; y++) {
    const empty = rows[y].ratio < 0.015;
    if (empty && !inGap) {
      inGap = true;
      gapStart = y;
    } else if (!empty && inGap) {
      inGap = false;
      const gapEnd = y - 1;
      if (gapEnd - gapStart >= 8) gaps.push({ start: gapStart, end: gapEnd, mid: Math.round((gapStart + gapEnd) / 2) });
    }
  }
  return { first, last, gaps };
}

async function main() {
  const transparent = await toTransparent(src);
  const trimmed = await sharp(transparent).trim({ threshold: 8 }).png().toBuffer();
  const { data, info } = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  console.log("trimmed", info.width, info.height);

  const rows = rowOccupancy(data, info.width, info.height);
  const bands = findContentBands(rows);
  console.log("bands", bands);

  // Heuristic: largest top block = mark, next = title, last = tagline
  const cuts = [bands.first, ...bands.gaps.map((g) => g.mid), bands.last + 1];
  console.log("cuts", cuts);

  // Prefer gap-based splits if we have exactly 2 gaps (icon / title / tagline)
  let markEnd;
  let titleEnd;
  if (bands.gaps.length >= 2) {
    markEnd = bands.gaps[0].mid;
    titleEnd = bands.gaps[1].mid;
  } else if (bands.gaps.length === 1) {
    markEnd = bands.gaps[0].mid;
    // Split remaining: title ~55%, tagline rest by scanning pink thin rows
    const rem = bands.last - markEnd;
    titleEnd = markEnd + Math.round(rem * 0.55);
  } else {
    markEnd = Math.round(info.height * 0.55);
    titleEnd = Math.round(info.height * 0.78);
  }

  // Refine markEnd: include full ticket (pink) — extend until pink density drops for a sustained stretch
  let pinkSeen = false;
  let lowPinkStreak = 0;
  for (let y = Math.round(info.height * 0.2); y < info.height; y++) {
    const pinkRatio = rows[y].pink / Math.max(1, rows[y].count);
    if (rows[y].pink > 20) pinkSeen = true;
    if (pinkSeen && rows[y].ratio > 0.01 && pinkRatio < 0.08 && rows[y].white > rows[y].pink) {
      // likely entered white "TICKET" text
      markEnd = y - 4;
      break;
    }
    if (pinkSeen && rows[y].ratio < 0.01) {
      lowPinkStreak++;
      if (lowPinkStreak > 6) {
        markEnd = y - 2;
        break;
      }
    } else {
      lowPinkStreak = 0;
    }
  }

  // Find title vs tagline: after mark, first dense white+pink block is title; thin pink-only is tagline
  let inTitle = false;
  titleEnd = markEnd;
  for (let y = markEnd; y < info.height; y++) {
    const dense = rows[y].ratio > 0.04;
    const thinPink = rows[y].pink > 5 && rows[y].white < 5 && rows[y].ratio < 0.08;
    if (dense && !thinPink) {
      inTitle = true;
      titleEnd = y;
    } else if (inTitle && (thinPink || rows[y].ratio < 0.01)) {
      // leaving title into gap/tagline
      if (rows[y].ratio < 0.01) {
        titleEnd = y;
        break;
      }
    }
  }
  // ensure titleEnd includes full title block
  for (let y = titleEnd; y < Math.min(info.height, titleEnd + 40); y++) {
    if (rows[y].ratio > 0.05 && rows[y].white > 10) titleEnd = y + 1;
  }

  console.log("final cuts", { markEnd, titleEnd, height: info.height });

  await sharp(trimmed).png().toFile(path.join(outDir, "logo-stacked-trim.png"));
  // Full stacked on transparent
  await sharp(trimmed).png().toFile(path.join(outDir, "logo-stacked.png"));
  // Full stacked with black bg for OG
  await sharp(src).resize(1200, 1200).png().toFile(path.join(outDir, "og-square.png"));

  const mark = await sharp(trimmed)
    .extract({ left: 0, top: 0, width: info.width, height: Math.max(40, markEnd) })
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
  const markMeta = await sharp(mark).metadata();
  console.log("mark", markMeta.width, markMeta.height);
  await sharp(mark).png().toFile(path.join(outDir, "logo-mark.png"));

  const title = await sharp(trimmed)
    .extract({
      left: 0,
      top: markEnd,
      width: info.width,
      height: Math.max(20, titleEnd - markEnd),
    })
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
  const titleMeta = await sharp(title).metadata();
  console.log("title", titleMeta.width, titleMeta.height);
  await sharp(title).png().toFile(path.join(outDir, "logo-title.png"));

  const tagline = await sharp(trimmed)
    .extract({
      left: 0,
      top: titleEnd,
      width: info.width,
      height: Math.max(10, info.height - titleEnd),
    })
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
  const tagMeta = await sharp(tagline).metadata();
  console.log("tagline", tagMeta.width, tagMeta.height);
  await sharp(tagline).png().toFile(path.join(outDir, "logo-tagline.png"));

  // Wordmark = title + tagline
  const word = await sharp(trimmed)
    .extract({ left: 0, top: markEnd, width: info.width, height: info.height - markEnd })
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
  await sharp(word).png().toFile(path.join(outDir, "logo-wordmark.png"));

  // Square mark for icons — pad with black
  const markApp = await sharp(mark)
    .resize(512, 512, {
      fit: "contain",
      background: { r: 5, g: 5, b: 5, alpha: 1 },
    })
    .png()
    .toBuffer();
  await sharp(markApp).toFile(path.join(outDir, "logo-mark-512.png"));
  await sharp(markApp).resize(192).toFile(path.join(outDir, "logo-mark-192.png"));
  await sharp(markApp).resize(64).toFile(path.join(outDir, "logo-mark-64.png"));
  await sharp(markApp).resize(32).toFile(path.join(outDir, "logo-mark-32.png"));
  await sharp(markApp).toFile(path.join(appDir, "icon.png"));
  await sharp(markApp).resize(180).toFile(path.join(appDir, "apple-icon.png"));
  await sharp(markApp).resize(32).toFile(path.join(outDir, "favicon-32.png"));
  await sharp(markApp).resize(16).toFile(path.join(outDir, "favicon-16.png"));
  await sharp(markApp).toFile(path.join(root, "public/icon.png"));

  // Transparent square mark
  await sharp(mark)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(outDir, "logo-mark-square.png"));

  // Horizontal lockup: mark + title
  const markHgt = 240;
  const markResized = await sharp(mark).resize({ height: markHgt }).png().toBuffer();
  const markRMeta = await sharp(markResized).metadata();
  const titleResized = await sharp(title).resize({ height: Math.round(markHgt * 0.42) }).png().toBuffer();
  const titleRMeta = await sharp(titleResized).metadata();
  const gap = 36;
  const horizW = markRMeta.width + gap + titleRMeta.width + 8;
  const horizH = Math.max(markRMeta.height, titleRMeta.height) + 8;
  const horizontal = await sharp({
    create: {
      width: horizW,
      height: horizH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: markResized, left: 0, top: Math.round((horizH - markRMeta.height) / 2) },
      {
        input: titleResized,
        left: markRMeta.width + gap,
        top: Math.round((horizH - titleRMeta.height) / 2),
      },
    ])
    .png()
    .toBuffer();

  await sharp(horizontal).toFile(path.join(outDir, "logo-horizontal.png"));
  await sharp(horizontal).resize({ height: 64 }).toFile(path.join(outDir, "logo-horizontal-sm.png"));
  await sharp(horizontal).resize({ height: 128 }).toFile(path.join(outDir, "logo-horizontal-md.png"));

  // Compact header: smaller mark + title
  await sharp(horizontal).resize({ height: 48 }).toFile(path.join(outDir, "logo-header.png"));

  console.log("done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
