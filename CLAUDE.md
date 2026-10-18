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
```

- Outside CI, run the e2e tests against a preinstalled Chromium with
  `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm test:e2e`
  (only the Chromium project runs). Don't run `playwright install` in cloud sessions.
- Markdown is formatted by hand (Prettier skips it); wrap at 100 columns.
- TypeScript is pinned to 6.x until typescript-eslint supports 7.
