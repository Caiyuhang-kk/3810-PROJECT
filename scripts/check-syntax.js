'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ejs = require('ejs');
const root = path.join(__dirname, '..');
let scripts = 0, templates = 0;

function check(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'coverage'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) check(file);
    else if (entry.name.endsWith('.js')) {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
      scripts++;
    } else if (entry.name.endsWith('.ejs')) {
      ejs.compile(fs.readFileSync(file, 'utf8'), { filename: file });
      templates++;
    }
  }
}
try {
  check(root);
  console.log(`PASS: ${scripts} JavaScript files and ${templates} EJS templates compile.`);
} catch (err) {
  console.error(err.stderr?.toString() || err.message);
  process.exitCode = 1;
}
