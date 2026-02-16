const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

if (!fs.existsSync(distDir)) {
  process.exit(0);
}

const files = ['project.config.json', 'project.private.config.json'];

for (const file of files) {
  const src = path.join(root, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}
console.log('[postbuild] project config files copied to dist');
