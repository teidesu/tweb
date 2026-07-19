#!/usr/bin/env node
// Rewrites upstream import specifiers (@helpers/..., @appManagers/..., ../relative)
// to the fork's @/ alias style. Usage:
//   node scripts/upstream-sync/normalize-imports.js [files...]
// With no args, processes .ts/.tsx files changed vs master (run from the sync worktree).

const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');
const {normalizeFileContent, getSrcDir} = require('./lib');

const cwd = process.cwd();
const srcDir = getSrcDir(cwd);

let files = process.argv.slice(2);
if(!files.length) {
  files = execSync('git diff --name-only --diff-filter=d master...HEAD -- "*.ts" "*.tsx"', {cwd, encoding: 'utf8'})
  .split('\n')
  .filter(Boolean);
}

let changed = 0;
for(const file of files) {
  if(!/\.tsx?$/.test(file)) continue;
  const abs = path.resolve(cwd, file);
  if(!fs.existsSync(abs)) continue;

  const content = fs.readFileSync(abs, 'utf8');
  const normalized = normalizeFileContent(content, abs, srcDir);
  if(normalized !== content) {
    fs.writeFileSync(abs, normalized);
    changed++;
    console.log(`normalized: ${file}`);
  }
}

console.log(`${changed} of ${files.length} files changed`);
