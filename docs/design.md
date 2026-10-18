# Electronics Kit: design

A browser game that teaches 7–12 year olds how electrical circuits work. Children place batteries,
wires, bulbs, switches, LEDs, resistors and more onto a virtual breadboard, and a real circuit
simulation decides what happens.

This document records the decisions made during the initial design interview. Each section gives
the decision and the main reason for it. When the design changes, update this file in the same PR.

---

## 1. Platform

| Decision | Detail |
|---|---|
| Form | A **TypeScript web app**, installable as a **PWA** and playable offline once loaded. |
| Hosting | **GitHub Pages** at `https://joshuaspence.github.io/electronics-kit/` (Vite `base: '/electronics-kit/'`, PWA scope to match). |
| Why not Unity | The game is 2D drag-and-drop. A browser handles that natively, loads fast, runs on iPads and school Chromebooks with nothing to install, and needs no Unity licence, keystores or Apple developer account. |
| Custom domain | Not now. Progress lives in browser storage tied to the origin, so **moving the domain after launch loses every child's progress** and makes installed copies different apps. Decide before real children use it. |

## 2. Players, accounts and data

- **Single-player. No accounts, no backend, no analytics, no ads, no third-party scripts.** For
  under-13s (COPPA, GDPR-K) the simplest compliance is collecting nothing.
- Progress is stored locally in **IndexedDB**. The app calls `navigator.storage.persist()`.
- Saved data carries a **schema version**; migrations live in `core/` and are unit-tested so that
  an update never wipes progress.
- **M1:** one implicit profile. **M3:** several local profiles (name + avatar, no passwords) for
  shared family and classroom devices, and **share links** that encode a circuit in the URL
  fragment (`#c=<compressed>`), which never reaches a server.
- Later: export/import progress as a file, and a teacher "unlock all" mode behind a parental gate.
- Out of scope: multiplayer, cloud sync, leaderboards, teacher dashboards.

## 3. Game structure

**A guided puzzle campaign, plus a sandbox that unlocks as the child progresses.**

- Short **levels**, each with one goal ("Make the bulb glow!"), a **limited parts tray** and usually
  a pre-placed battery. **Win checks run against the simulated circuit**, not a fixed layout, so any
  correct circuit wins.
- Levels are grouped into **chapters**, each introducing one concept:
  1. A complete loop
  2. Switches and open circuits
  3. Series vs parallel (brightness)
  4. LEDs and polarity
  5. Resistors, and why LEDs need them
  6. Short circuits
  7. Inputs and outputs: buttons, light sensors, buzzers, motors, timers
- The **sandbox** offers every part unlocked so far, so it grows with the child.
- **Failure is explained and safe, never "game over".** A shorted battery gets a cartoon "hot!"
  warning; a backwards LED stays dark with a polarity hint; an over-driven LED pops with a comic puff
  and comes back on undo.
- **Stars (1–3)** reward fewer parts and no hints, **never speed**. No level has time pressure.

## 4. Circuit simulation

**One modified nodal analysis (MNA) engine in `core/`, with two solve modes sharing all component
models.**

1. **DC operating point**, solved immediately whenever the circuit changes (capacitors open). Gives
   instant feedback while editing, is the starting state for the transient run, and is what most
   chapter 1–5 win checks evaluate.
2. **Transient run** from that operating point at a **fixed Δt = 1 ms**, using backward-Euler
   companion models for capacitors. Fixed steps make it **deterministic**: tests can assert "the LED
   is on at t = 2.0 s". It runs in **real time** by default with **slow motion (¼×, ⅒×)**, and
   restarts from the DC point whenever the circuit is edited. When the circuit has nothing
   time-dependent, steps just repeat the DC answer. If a circuit is too large, the step count adapts
   down rather than dropping frames.

| Part | Model |
|---|---|
| Battery | Ideal voltage source + small internal resistance (a short gives a large, finite current). **Never drains.** |
| Wire, closed switch, pressed button | ≈ 0 Ω; open = disconnected |
| Bulb | Resistor; brightness from power |
| Resistor | Resistor |
| LED | Piecewise-linear diode: conducts forward above Vf ≈ 2 V with a small series resistance; state found by a few fixed-point iterations; brightness from current; pops above ~30 mA |
| Buzzer, motor | Resistive load with an activation threshold |
| Light sensor (LDR) | Variable resistance from a slider or ambient light |
| Capacitor | Backward-Euler companion model (transient only) |
| Blinker chip | 555-style behavioural block: output switches when its timing capacitor crosses thresholds |

**Presentation: no numbers by default.** Current is shown as **flowing dots** whose speed follows
the current. An unlockable **multimeter** shows volts and milliamps for older children.

## 5. Breadboard

**A real breadboard layout, chunky and forgiving, that grows by chapter.**

- Columns of 5 connected holes (a–e, f–j), a centre gap, and **+/− power rails**, so a child who
  later picks up a real kit already understands one.
- **Hidden connections are made visible:** touching or hovering a hole highlights its whole strip,
  live strips glow, and an "X-ray" toggle shows the metal clips.
- Size by chapter: **chapter 1** has no breadboard (parts snap onto big terminals, Snap Circuits
  style); **chapter 2** a ~10-column mini board; later chapters a half-size board with rails; the
  sandbox a full-size board with pan and zoom.
- **Placement:** drag a part from the tray and its legs snap to the nearest valid holes (fixed leg
  spacing per part); rotate with a button; draw wires by dragging hole to hole. Battery packs sit
  off the board with leads into the rails.
- **Touch targets:** holes at least ~9 mm apart at default zoom, forgiving snapping, and a ghost
  preview before dropping.
- **Mistakes are simulated, not blocked.** Only physically impossible placements (two legs in one
  hole) are refused.

## 6. Text, hints and language

- **Assume the child can read.** No narration. Goals are an icon plus a short, plain sentence.
- **Hints escalate** after ~30 s without progress or after a failed attempt: a nudge, then a
  highlight of the problem area, then a ghost of one part's placement. Never an automatic solution.
- A **"Why?" card** after each level explains the concept in a sentence or two, with "Tell me more"
  using real terms (volts, current, resistance) for older children.
- **Australian English.** All text lives in string files from day one so translation is possible.
- Accessibility: colour-blind-safe wire colours that are also distinguishable by pattern or label, a
  reduce-motion setting, no time pressure, and no hover-only interactions.

## 7. Art, sound and mascot

- **Flat, friendly vector art that stays recognisable**: an LED has a long and a short leg,
  resistors have colour bands. Everything is SVG, drawn in code, behind a `PartSkin` interface so
  real art can replace it later. Light theme only.
- Feedback: bulb glow, spinning motors, wobbling buzzers, flowing current dots, a confetti burst on
  success.
- **Sound** effects synthesised with the Web Audio API (snap, a buzzer that follows the simulation,
  pop, chime). No music in M1. One always-visible mute button; silent until the first interaction.
- **Mascot: Volty**, a chunky orange AA-style battery with a face, arms and a + cap. It must look
  clearly different from the black battery packs used as parts. Volty gives hints and "Why?"
  cards, uses static poses with simple CSS motion, and never interrupts a drag.

## 8. Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript, `strict` |
| Build | Vite, `build.target: 'es2022'`; `vite-plugin-pwa` for the service worker |
| UI | React 19 |
| Board rendering | SVG via React components (Canvas only if profiling demands it) |
| Drag and drop | Pointer Events, hand-written (touch, mouse and pen) |
| State | A plain TS store in `core/` with a small React hook; undo/redo as a command stack |
| Unit tests | Vitest |
| End-to-end tests | Playwright, Chromium and WebKit, with a tablet viewport |
| Lint/format | ESLint (typescript-eslint) + Prettier; a lint rule bans `core/` from importing `ui/` or React |
| Package manager | pnpm, Node version pinned |
| Deploy | `actions/deploy-pages` on push to `master` |
| PR previews | The built site uploaded as a workflow artifact |
| Dependency updates | Dependabot (npm and GitHub Actions, weekly, minor/patch grouped) |

Layout:

```
src/core/    pure TS: netlist, MNA solver, parts, levels, win checks, progress (no DOM, no React)
src/ui/      React + SVG: board, tray, hints, screens
src/levels/  level data
tests/e2e/   Playwright
```

## 9. Browsers, devices and performance

- **Browsers:** the last two versions of Chrome, Edge, Firefox and Safari, and **iPadOS Safari
  16.4+**.
- **Devices:** primarily tablets in landscape and Chromebooks; secondarily desktops and phones in
  landscape (with a "better on a bigger screen" note). Portrait shows a rotate prompt.
- **Low-end baseline:** an **iPad 9th gen (A13)** and a **4 GB Intel Celeron Chromebook**.
  - **60 fps** while dragging; simulation plus rendering under 8 ms per frame for a 30-part circuit.
  - **First load under 1 MB** gzipped JS+CSS, interactive in under 3 s on school Wi-Fi.
- **Enforced in CI** by a bundle-size budget and a `core/` solver benchmark (a 50-node circuit for
  1,000 steps), plus a manual check on a real device before each release.

## 10. Releases

- **Every merge to `master` deploys** to GitHub Pages. No tagged releases.
- The settings screen shows the `package.json` version and short git SHA.
- A new service worker shows **"New version available — tap to update"**; it never reloads silently
  in the middle of a level.

## 11. Milestones

Each milestone is a stack of small PRs (under ~1,500 changed lines each).

- **M0: Plumbing.** This design doc and `CLAUDE.md`; the Vite/React/TS scaffold with lint, Vitest,
  Playwright and a hello-board page; CI (lint, typecheck, unit, e2e, build, preview artifact,
  budgets), Pages deploy and Dependabot.
- **M1: Chapters 1–2 playable.** Netlist, MNA solver (DC + transient, capacitors tested in core),
  battery, wire, bulb, switch and push button; level definitions, win checks, undo/redo, IndexedDB
  progress. Snap-terminal chapter 1, mini breadboard chapter 2 with strip highlighting; drag and
  snap, rotate, tray, flowing dots, glow, short-circuit warning; Volty hints, "Why?" cards, stars,
  level select, sound effects; 12–16 levels; installable and offline.
- **M2: Chapters 3–5.** Series/parallel, LEDs and polarity, resistors and blown LEDs; half-size
  breadboard with rails; resistor colour bands; multimeter.
- **M3: Sandbox, profiles and share links.** Full-size board with pan and zoom, local profiles,
  `#c=` share URLs.
- **M4: Time-based parts.** Capacitors in the UI, the blinker chip, buzzer, motor, light sensor and
  slow motion; chapters 6–7.
- **Later:** export/import progress, teacher "unlock all", translations, recorded hints, iPad
  home-screen polish.
