// Fails when a line of tracked Markdown is wider than 100 characters (CLAUDE.md: Markdown is
// formatted by hand). Tables and fenced code can't be wrapped, so they're skipped. Width counts
// characters, not bytes, so an em dash is one column.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MAX_WIDTH = 100;

const files = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const problems = [];
for (const file of files) {
  let fenced = false;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        return;
      }
      const width = [...line].length;
      if (!fenced && !line.trimStart().startsWith('|') && width > MAX_WIDTH) {
        problems.push(`${file}:${index + 1}: ${width} columns`);
      }
    });
}

if (problems.length > 0) {
  console.error(`Markdown wider than ${MAX_WIDTH} columns:\n${problems.join('\n')}`);
  process.exit(1);
}
