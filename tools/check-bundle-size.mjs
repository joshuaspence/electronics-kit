// Fails when the gzipped JS and CSS in dist/ exceed the first-load budget (docs/design.md §9).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 1024 * 1024;
const root = process.argv[2] ?? 'dist';

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      yield* files(path);
    } else if (/\.(js|css)$/.test(name)) {
      yield path;
    }
  }
}

let total = 0;
for (const path of files(root)) {
  const size = gzipSync(readFileSync(path), { level: 9 }).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(8)} KiB  ${path}`);
}

const kib = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
if (total === 0) {
  console.error(`No JS or CSS found under ${root}; run pnpm build first.`);
  process.exit(1);
}
if (total > BUDGET_BYTES) {
  console.error(`Gzipped JS + CSS is ${kib(total)}, over the ${kib(BUDGET_BYTES)} budget.`);
  process.exit(1);
}
console.log(`Gzipped JS + CSS is ${kib(total)} of the ${kib(BUDGET_BYTES)} budget.`);
