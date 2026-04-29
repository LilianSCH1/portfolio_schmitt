const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const outDir = path.join(repoRoot, 'public');
const items = [
  'portfolio.html',
  'projects-academiques.html',
  'index.html',
  'assets',
  'cv',
  'js',
  'uploads'
];

async function copyRecursive(src, dest) {
  const stat = await fs.promises.stat(src);
  if (stat.isDirectory()) {
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src);
    for (const e of entries) {
      await copyRecursive(path.join(src, e), path.join(dest, e));
    }
  } else if (stat.isFile()) {
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(src, dest);
  }
}

async function build() {
  try {
    await fs.promises.rm(outDir, { recursive: true, force: true });
    await fs.promises.mkdir(outDir, { recursive: true });
    for (const item of items) {
      const src = path.join(repoRoot, item);
      const dest = path.join(outDir, path.basename(item));
      try {
        await copyRecursive(src, dest);
        console.log('Copied', item);
      } catch (err) {
        // ignore missing files
      }
    }
    console.log('Build complete. Output in', outDir);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

build();
