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
- Progress is stored locally in **IndexedDB** (`src/ui/progressStore.ts`). The app calls
  `navigator.storage.persist()`. It saves only when the child earns stars, and only after saved
  progress has loaded, merging in anything earned in the meantime. If storage is refused (private
  windows, locked-down devices) the game plays on without saving.
- Saved data carries a **schema version**; migrations live in `core/` and are unit-tested so that
  an update never wipes progress (`src/core/progress.ts`). Progress is the best stars per level.
  Data that can't be read (corrupt, or written by a newer version) loads as no progress and is
  only overwritten once the child finishes a level; unreadable entries are dropped one by one.
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
  and comes back on undo. A blown LED is part of the build (`blown`, open from then on), set by
  `blowOverdrivenLeds` as `BuildEditor` settles each edit, so it belongs to the edit that overdrove
  it and is never an undo step of its own: one undo takes back both.
- **Stars (1–3)** reward fewer parts and no hints, **never speed**: one for finishing, one for
  placing no more than the level's par, one for using no hints. No level has time pressure.
- **Goals** (`src/core/levels.ts`) are evaluated on the DC solution. A bulb is *lit* at a quarter
  of full brightness or more. `light-bulbs` needs N lit bulbs with every switch closed and button
  pressed; `control-bulbs` also needs every bulb dark with every switch open and button released;
  `every-control` also needs them dark with any one switch open or button released and the rest
  on. No goal is met while a battery is shorted, and a failed check says why (short circuit, too
  few lit, not controlled, no switch, not every control) so hints can respond to it.
- **No level needs two buttons held at once:** a mouse or touchpad has one pointer, and Chromebooks
  are a primary target (§9). Levels about needing several controls use switches.
- **Level data** (`src/levels/`): each level has a board, its starting parts (fixed, or movable
  ones that count against the tray), a goal, a tray, a par and a **solution**. Unit tests check
  every level starts unsolved and that its solution finishes it at par using only its tray; hints
  can show the solution's parts later. Level text lives in `src/levels/strings.ts`.
- **Chapter 1 levels:** *Light it up* (bulb and two wires), *The long way round* (a far-away bulb),
  *Mind the gap* (one missing wire), *Double bright* (two bulbs in one loop), *Shortcut!* (remove a
  wire that shorts the battery) and *Two gaps* (closing one gap still lights nothing).
- **Chapter 2 levels** (mini breadboard): *Hidden wires* (a bulb in the battery's columns, no
  wires), *Sneaky strip* (a bulb with both legs in one column, shorted out by the strip), *One
  column out* (a wire one column off), *Flick the switch*, *Press to glow* (a button), *All
  together* (one switch, two bulbs), *Out of the loop* (move a switch from beside the loop into it)
  and *Both switches* (two switches in series: an AND).
- **Finishing:** the first time the goal is met *and* the goal's bulbs are lit with the switches as
  the child left them (so a switch level finishes when they switch it on), a card floats over the
  bottom of the screen with the stars and the "Why?" text, leaving the working circuit in view, and
  offers the next level. Parts the level started with don't count towards par. The level list shows
  the best stars; every level is open from the start.

## 4. Circuit simulation

**One modified nodal analysis (MNA) engine in `core/`, with two solve modes sharing all component
models.**

1. **DC operating point**, solved immediately whenever the circuit is edited (capacitors open). Gives
   instant feedback while editing, is the starting state for the transient run, and is what most
   chapter 1–5 win checks evaluate.
2. **Transient run** at a **fixed Δt = 1 ms**, using backward-Euler companion models for
   capacitors. It starts at t = 0 with **every capacitor discharged**: an uncharged capacitor
   conducts like a wire for that instant, so the child sees the inrush and then watches it charge.
   Without capacitors the run starts from, and stays at, the DC operating point. Fixed steps make
   it **deterministic**: tests can assert "the LED is on at t = 2.0 s". It runs in **real time** by
   default with **slow motion (¼×, ⅒×)**. If a circuit is too large, the step count adapts down
   rather than dropping frames.

**Edits vs inputs.** An **edit** — adding, moving, rotating or removing a part or wire —
re-solves the DC point and restarts the transient run from t = 0 (`new TransientSimulation`). An
**input** — flipping a switch, pressing or releasing a button, moving a light-sensor slider —
changes a part's value inside the running transient (`applyInput`) and keeps capacitor and timer
state, so timers and capacitors behave like the real thing.

| Part | Model |
|---|---|
| Battery | Ideal voltage source + small internal resistance (a short gives a large, finite current). **Never drains.** |
| Wire, closed switch, pressed button | 1 mΩ resistor (not merged into one node, so every wire's current is known for the flowing dots and parallel wires share it); open = disconnected |
| Bulb | Resistor; brightness from power |
| Resistor | Resistor |
| LED | Piecewise-linear diode: open when off; on, a 2 V source behind 10 Ω, anode to cathode. Starting all off, each round turns on exactly the LEDs with more than 2 V across them, until none changes (`solveWithLeds`, shared by DC and transient). Brightness from current (full at 20 mA); pops above 30 mA |
| Buzzer, motor | Resistive load with an activation threshold |
| Light sensor (LDR) | Variable resistance from a slider or ambient light |
| Capacitor | Backward-Euler companion model (transient only) |
| Blinker chip | 555-style behavioural block: output switches when its timing capacitor crosses thresholds |

**Solver details** (`src/core/mna.ts`, `dc.ts`, `transient.ts`, `linear.ts`). Every part has two
pins on *points* (a breadboard strip, a snap terminal); pins on the same point are connected. Every
part is stamped as a Norton equivalent (a conductance in parallel with a current source): a
resistor has no source, a battery is its source and internal resistance, and a capacitor in a time
step is its backward-Euler companion. So the system is pure nodal analysis with no extra unknowns,
solved by dense Gaussian elimination with partial pivoting. A 10⁻⁹ S conductance from every point
to an implicit ground keeps loose parts and separate circuits solvable. A battery counts as
**shorted** when it delivers more than half its short-circuit current, that is, when its load has
less resistance than the battery itself. Bulb brightness is power over rated power, capped at 1.

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
- **Snap board** (chapter 1): a grid of big metal posts (`{ kind: 'snap', rows, columns }`), 110
  board units apart against the breadboard's 40. Every part reaches the next post; wires go from any
  post to any other. A post takes any number of parts and is drawn above them, so a wire can always
  start from it. Each post is its own point: nothing is joined underneath.
- **Placement:** drag a part from the tray and its legs snap to the nearest valid holes (fixed leg
  spacing per part); rotate with a button; draw wires by dragging hole to hole. Battery packs sit
  off the board with leads into the rails.
- **Interaction** (`src/ui/Workbench.tsx`). A part is held by its middle while dragged, with a ghost
  where it will land; dropping off the board or on a taken hole just puts nothing down. Dragging a
  placed part moves it; tapping it selects it for **Rotate** and **Remove**, and also flips a
  switch. A button is pressed only while held. **Rotate** turns the selected part a quarter
  clockwise about its middle, so two turns swap its legs: that is how an LED is turned round.
  With nothing selected it turns the parts that come out of the tray. Undo and redo are buttons,
  always visible. The board keeps to the height of the screen so a landscape tablet shows all of
  it.
- **Touch targets:** holes at least ~9 mm apart at default zoom, forgiving snapping, and a ghost
  preview before dropping.
- **Mistakes are simulated, not blocked.** Only physically impossible placements (two legs in one
  hole, a part's two legs in the same hole, a leg off the board) are refused, along with placing
  more of a part than the tray holds or moving a part the level placed. A snap terminal takes any
  number of parts.
- **Build model** (`src/core/build.ts`). A build is placed parts at board locations; `toCircuit`
  maps each location to a simulator point (a breadboard strip, or a snap terminal). `BuildEditor`
  keeps undo and redo: every place, move (rotation included) or removal is one undo step, while
  flipping a switch or pressing a button is not, and stays as the child left it across undo.

## 6. Text, hints and language

- **Assume the child can read.** No narration. Goals are an icon plus a short, plain sentence.
- **Hints escalate** (`src/core/hints.ts`). After 30 s without a change Volty bobs and offers help;
  tapping Volty asks. The first hint is a nudge saying what is wrong (a broken loop, a short
  circuit, a switch outside the loop, a circuit that only needs switching on). Each further tap
  points at one step of the level's solution: a part to remove (it pulses), whether a starting part
  or one the child put where the solution has none, then a part to place (drawn faintly where it
  goes). Never an automatic solution. Any hint costs the "no hints" star. Tests check that following
  the hints alone finishes every level, from its start and from a build with a misplaced part.
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
- **Current dots** (`src/core/flow.ts`): white dots run along every part and wire carrying at least
  1 mA, in the direction of conventional current. Their speed grows with the logarithm of the
  current (20 board units/s at 1 mA, +20 per tenfold, capped at 120), so a dim LED still visibly
  flows and a short circuit races. They stop under reduce-motion.
- **Short circuit:** the shorted battery turns red and pulses with a "Hot!" label, a plain-words
  warning appears above the board (an ARIA status), and a low buzz plays once as it happens.
- **Mascot: Volty**, a chunky orange AA-style battery with a face, arms and a + cap. It must look
  clearly different from the black battery packs used as parts. Volty gives hints and "Why?"
  cards, uses static poses with simple CSS motion, and never interrupts a drag.

## 8. Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript 6, `strict` (7 once typescript-eslint supports it) |
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
| PR previews | The built site uploaded as the `site` artifact of the CI run |
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
- **Enforced in CI** by a bundle-size budget (`pnpm size`, `tools/check-bundle-size.mjs`) and a
  `core/` solver benchmark (a 50-node circuit for 1,000 steps, added with the solver in M1), plus a
  manual check on a real device before each release.

## 10. Releases

- **Every merge to `master` deploys** to GitHub Pages. No tagged releases.
- The level list's footer shows the `package.json` version and short git SHA (a settings screen
  later).
- A new version shows **"A new version of Electronics Kit is ready."** with an **Update** button; it
  never reloads by itself. The offer appears only on the level list, never in the middle of a level.
- **PWA** (`vite-plugin-pwa`, `generateSW`): the service worker precaches every built file, so the
  game works offline once loaded. The manifest names the app "Electronics Kit" ("Circuits" on the
  home screen), in landscape, with a bulb icon in SVG and PNG (`public/`).

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
