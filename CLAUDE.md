# CLAUDE.md

A browser game (TypeScript PWA on GitHub Pages) that teaches 7–12 year olds about electrical
circuits on a virtual breadboard. Read [`docs/design.md`](docs/design.md) before changing
behaviour: it records the decisions already made (no backend, MNA circuit solver, breadboard
layout, chapters, tech stack…) and the milestone plan. Update it in the same PR when a decision
changes.

## Pull requests

- **`master` is the default branch.** Branch from `origin/master` and open a PR; don't push to
  `master`.
- **Open PRs ready for review, not as drafts.** `claude.yaml` reviews every non-draft PR on each
  push; a draft gets no review.
- **Keep PRs small enough to review in full** — roughly under 1,500 changed lines and one
  concern each. The automated reviewer reads only part of a larger PR and won't approve it.
  Split big work into a stack of PRs, each based on the one before; when a lower one is
  squash-merged, rebase the rest onto `master` so each diff shows only its own change.
- **Show what a player will see.** A PR that changes what a player sees or does (`src/ui`,
  `src/levels` or the player-facing strings) ends its body with a `## Screenshots` section:
  captioned shots on a landscape tablet (1180×820), with a before and after where an existing
  screen changes. Show motion or interaction as two to four stills in sequence, or as a video when
  you can make one. A refactor that changes nothing visible says "No visible change" there instead.
- **Keep an agent's screenshots on the `pr-media` branch.** GitHub has no API for adding images to
  a PR body, so commit them under `<pr-number>/` on the orphan `pr-media` branch, which is never
  merged and never pruned. Embed them by a `raw.githubusercontent.com` URL pinned to that commit,
  so a later push can't change what an old PR shows.
- **Screenshot your own build.** Other sessions run previews on this machine, and one may answer
  on your port. Serve yours on a free random port with `--strictPort` (under Playwright, `CI=1`
  stops it reusing a running server) and check that the served `index.html` matches your
  `dist/index.html`.
- **A PR is not done when it is opened.** Watch it: fix failing checks, and address each review
  finding or reply with why not, then resolve the thread.
- **Enable squash auto-merge on every PR** right after opening it (`gh pr merge --auto --squash`).
  The `master` ruleset requires green CI, an approval (Claude's counts) and resolved
  conversations, so auto-merge only fires once all of those are met — don't merge by hand.

## Code layout

- **`src/core`** — framework-independent logic: netlist, circuit solver, parts, levels, win
  checks, saved-progress schema and migrations. No DOM, no React. It must have Vitest coverage.
- **`src/ui`** — React + SVG: board, parts tray, hints, screens. Keep it thin.
- **`src/levels`** — level data.
- Player-facing text lives in string files, in **Australian English**.
- No analytics, ads or third-party scripts, and no network calls other than to the game's own site
  (loading and service-worker updates): the game collects nothing.

## Before pushing

```sh
pnpm install
pnpm lint         # ESLint + Prettier check (pnpm format fixes formatting)
pnpm typecheck    # whole project, then src/core alone without DOM types
pnpm test         # Vitest unit tests
pnpm test:e2e     # Playwright: builds, serves the preview and runs tests/e2e
pnpm build && pnpm size   # gzipped JS + CSS must stay under the 1 MiB first-load budget
```

- Outside CI, run the e2e tests against a preinstalled Chromium with
  `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm test:e2e`
  (only the Chromium project runs). Don't run `playwright install` in cloud sessions.
- `ci.yml` runs all of these on every PR; `deploy.yml` publishes `master` to GitHub Pages.
- Markdown is formatted by hand (Prettier skips it); wrap at 100 columns.
- TypeScript is pinned to 6.x until typescript-eslint supports 7.
