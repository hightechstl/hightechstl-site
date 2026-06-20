#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {copyFile, cp, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const adventureRoot = path.join(repoRoot, 'content/adventures/lanterns-below-marrow-hill');
const sourceRoot = path.join(adventureRoot, 'source');
const configPath = path.join(adventureRoot, 'adventure.config.json');
const distRoot = path.join(repoRoot, 'dist/shopify-digital-products');
const tempRoot = path.join(repoRoot, 'dist/.adventure-product-build');

const config = JSON.parse(readFileSync(configPath, 'utf8'));

const printFiles = [
  'quickstart.html',
  'storyboard.html',
  'role-sheet-wickbearer.html',
  'role-sheet-stone-listener.html',
  'clue-deck.html',
  'endings.html'
];

const sceneArtFiles = [
  'scene-1-entry-stair.png',
  'scene-2-candle-hall.png',
  'scene-3-mirror-pool.png',
  'scene-4-lantern-heart.png'
];

const editions = [
  {
    key: 'quickPlay',
    id: 'quick-play',
    zipName: 'Lanterns_Below_Marrow_Hill_Quick_Play_Edition.zip',
    includePremiumArt: false
  },
  {
    key: 'deluxe',
    id: 'deluxe',
    zipName: 'Lanterns_Below_Marrow_Hill_Deluxe_Edition.zip',
    includePremiumArt: true
  }
];

function ensureDir(dir) {
  mkdirSync(dir, {recursive: true});
}

function readMeHtml(edition) {
  const editionConfig = config.editions[edition.key];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Read Me First - ${escapeHtml(config.title)} ${escapeHtml(editionConfig.name)}</title>
  <style>
    body{font-family:Arial,sans-serif;line-height:1.6;max-width:820px;margin:0 auto;padding:32px;color:#201914;background:#fff8ec}
    h1,h2{font-family:Georgia,serif;color:#2b1c14}
    code{background:#f0e3cf;padding:2px 5px;border-radius:4px}
    .box{border:1px solid #d7c1a0;border-radius:10px;padding:18px;background:#fff}
  </style>
</head>
<body>
  <h1>Thank you for purchasing ${escapeHtml(config.title)}</h1>
  <p><strong>${escapeHtml(editionConfig.name)}</strong> is a complete two-player Adventure Nights package for a one-night mystery session.</p>
  <div class="box">
    <h2>You can play two ways</h2>
    <ol>
      <li><strong>Browser Play:</strong> go to <a href="${config.browserPlayUrl}">${config.browserPlayUrl}</a>.</li>
      <li><strong>Print &amp; Play:</strong> open the files in <code>PRINT_AND_PLAY</code> and print them, or use your browser's Print -> Save as PDF option.</li>
    </ol>
  </div>
  <h2>Online access</h2>
  <p>For browser play, sign in with the same email address you used at checkout. Purchases should unlock automatically once your Adventure Nights account uses that email.</p>
  <p>If your adventure does not appear, use your redeem code from the order email at <a href="${config.redeemUrl}">${config.redeemUrl}</a> or contact <a href="mailto:${config.supportEmail}">${config.supportEmail}</a>.</p>
  <p>This ZIP itself does not contain a unique unlock code because unlocks are tied to purchase records. Static Shopify download files are the same for every customer.</p>
  <h2>What's inside</h2>
  <ul>
    <li><code>PRINT_AND_PLAY</code>: print-ready adventure sheets, map, and tokens.</li>
    <li><code>BROWSER_PLAY</code>: browser content files and online play instructions.</li>
  </ul>
</body>
</html>
`;
}

function browserInstructionsHtml(edition) {
  const editionConfig = config.editions[edition.key];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Browser Play Instructions - ${escapeHtml(config.title)}</title>
</head>
<body>
  <h1>Browser Play Instructions</h1>
  <p>This ${escapeHtml(editionConfig.name)} ZIP includes browser-ready content, but the easiest way to play is through Adventure Nights online.</p>
  <ol>
    <li>Go to <a href="${config.browserPlayUrl}">${config.browserPlayUrl}</a>.</li>
    <li>Create or sign in to your Adventure Nights account.</li>
    <li>Use the same email address used at checkout.</li>
    <li>If needed, redeem your backup code at <a href="${config.redeemUrl}">${config.redeemUrl}</a>.</li>
  </ol>
  <p>No unique unlock code is stored in this ZIP. Codes are generated separately from purchase records.</p>
</body>
</html>
`;
}

function licenseText() {
  const year = new Date().getFullYear();
  return `Adventure Nights Personal Use License

Copyright ${year} J2 Crafts / Adventure Nights / HighTechSTL.

You may:
- Use these files for personal play.
- Print copies for your own personal game session.
- Save print-ready HTML files as PDFs for personal use.

You may not:
- Resell, redistribute, upload, or share these files.
- Use the art, maps, tokens, writing, or assets in other products.
- Remove attribution or present this package as your own work.

Online unlocks are tied to purchase records, purchase email, and/or separately
generated redeem codes. This ZIP intentionally does not contain a unique unlock
code because Shopify digital product files are shared static downloads.
`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function copyRequiredFile(from, to) {
  if (!existsSync(from)) throw new Error(`Missing required source file: ${from}`);
  ensureDir(path.dirname(to));
  await copyFile(from, to);
}

async function copySceneArt(toDir) {
  ensureDir(toDir);
  for (const file of sceneArtFiles) {
    await copyRequiredFile(
      path.join(sourceRoot, 'assets/scene-art', file),
      path.join(toDir, file)
    );
  }
}

function createQuickPlayBundle() {
  const bundle = JSON.parse(readFileSync(path.join(sourceRoot, 'content/adventure-app-bundle.json'), 'utf8'));
  bundle.packageEdition = 'quick-play';
  bundle.adventure.edition = 'quick-play';
  bundle.adventure.browserFlow = (bundle.adventure.browserFlow || []).map((item) =>
    item === 'Subscription gate' ? 'Purchase or redeem gate' : item
  );
  if (bundle.portalPresentation?.libraryTile) {
    bundle.portalPresentation.libraryTile.thumbnailAsset = '';
  }
  if (bundle.portalPresentation) {
    bundle.portalPresentation.sceneArt = [];
  }
  if (bundle.downloadables?.visualAssets) {
    bundle.downloadables.visualAssets = bundle.downloadables.visualAssets.filter((asset) =>
      ['assets/map.svg', 'assets/tokens.svg'].includes(asset.file)
    );
  }
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

function createDeluxeBundle() {
  const bundle = JSON.parse(readFileSync(path.join(sourceRoot, 'content/adventure-app-bundle.json'), 'utf8'));
  bundle.packageEdition = 'deluxe';
  bundle.adventure.edition = 'deluxe';
  bundle.adventure.browserFlow = (bundle.adventure.browserFlow || []).map((item) =>
    item === 'Subscription gate' ? 'Purchase or redeem gate' : item
  );
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

async function stageEdition(edition) {
  const stageDir = path.join(tempRoot, edition.id);
  rmSync(stageDir, {recursive: true, force: true});
  ensureDir(stageDir);
  ensureDir(path.join(stageDir, 'PRINT_AND_PLAY'));
  ensureDir(path.join(stageDir, 'BROWSER_PLAY'));

  writeFileSync(path.join(stageDir, 'READ_ME_FIRST.html'), readMeHtml(edition));
  writeFileSync(path.join(stageDir, 'LICENSE.txt'), licenseText());
  writeFileSync(path.join(stageDir, 'BROWSER_PLAY/browser-play-instructions.html'), browserInstructionsHtml(edition));

  for (const file of printFiles) {
    await copyRequiredFile(path.join(sourceRoot, 'print', file), path.join(stageDir, 'PRINT_AND_PLAY', file));
  }

  for (const folder of ['PRINT_AND_PLAY', 'BROWSER_PLAY']) {
    await copyRequiredFile(path.join(sourceRoot, 'assets/map.svg'), path.join(stageDir, folder, 'map.svg'));
    await copyRequiredFile(path.join(sourceRoot, 'assets/tokens.svg'), path.join(stageDir, folder, 'tokens.svg'));
  }

  const bundleJson = edition.includePremiumArt ? createDeluxeBundle() : createQuickPlayBundle();
  writeFileSync(path.join(stageDir, 'BROWSER_PLAY/adventure-app-bundle.json'), bundleJson);

  if (edition.includePremiumArt) {
    await copyRequiredFile(path.join(sourceRoot, 'assets/library-thumbnail.png'), path.join(stageDir, 'PRINT_AND_PLAY/library-thumbnail.png'));
    await copyRequiredFile(path.join(sourceRoot, 'assets/library-thumbnail.png'), path.join(stageDir, 'BROWSER_PLAY/library-thumbnail.png'));
    await copySceneArt(path.join(stageDir, 'PRINT_AND_PLAY/scene-art'));
    await copySceneArt(path.join(stageDir, 'BROWSER_PLAY/scene-art'));
  }

  await assertCleanStage(stageDir);
  return stageDir;
}

async function assertCleanStage(stageDir) {
  const blocked = [];
  async function walk(dir) {
    const entries = await readdir(dir, {withFileTypes: true});
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const rel = path.relative(stageDir, fullPath);
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.git') {
        blocked.push(rel);
      }
      if (entry.isDirectory()) await walk(fullPath);
    }
  }
  await walk(stageDir);
  if (blocked.length) throw new Error(`Blocked files found in staged product: ${blocked.join(', ')}`);
}

function zipStage(stageDir, zipPath) {
  rmSync(zipPath, {force: true});
  const result = spawnSync('zip', ['-qr', zipPath, '.'], {
    cwd: stageDir,
    stdio: 'inherit'
  });
  if (result.status !== 0) throw new Error(`zip failed for ${zipPath}`);
  const size = statSync(zipPath).size;
  console.log(`Created ${path.relative(repoRoot, zipPath)} (${Math.round(size / 1024)} KB)`);
}

async function main() {
  if (!existsSync(sourceRoot)) throw new Error(`Missing source folder: ${sourceRoot}`);
  ensureDir(distRoot);
  rmSync(tempRoot, {recursive: true, force: true});
  ensureDir(tempRoot);

  for (const edition of editions) {
    const stageDir = await stageEdition(edition);
    zipStage(stageDir, path.join(distRoot, edition.zipName));
  }

  rmSync(tempRoot, {recursive: true, force: true});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
