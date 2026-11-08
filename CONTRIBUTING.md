# Contributing to Tama

A quick path from `git clone` to your first change, plus how we build and release. For the product, see the
[README](README.md); for the rules every change follows, see [AGENTS.md](AGENTS.md).

## 1. First run (about 10 minutes)

You need **Windows 10/11** (macOS runs from source with fewer features), **[Node.js](https://nodejs.org) 22+**
(`.nvmrc` pins 22) and **git**.

```
git clone https://github.com/philipuscahyadi02-hub/tama.git
cd tama
npm run setup        # npm install + downloads Electron if npm skipped it + checks your machine
npm run dev          # starts Tama with a scratch data folder (.dev-data/)
```

`npm run setup` ends with a report from `npm run doctor`. ✔ = ready, ✘ = required, ○ = optional, each with the
exact next step. Run `npm run doctor` again any time.

**What works with which tools.** The app starts and the pet, care, todos, focus timer and reminders work with
nothing else installed. These parts are optional:

| Tool | Unlocks | Install |
|---|---|---|
| [Claude Code](https://docs.claude.com/en/docs/claude-code) | Terminal (coding), AI designer; chat if you opt in | `irm https://claude.ai/install.ps1 \| iex`, then `claude` once to sign in |
| Antigravity CLI (`agy`) | Chat, her moments, diary, Japanese dub | `irm https://antigravity.google/cli/install.ps1 \| iex`, then `agy` once |
| AivisSpeech / VOICEVOX Engine | Japanese anime voice | The in-app setup wizard (`/setup`) shows how |
| Google OAuth client, Telegram bot | Google and phone features | Set up inside the app (Settings) |

Tama uses each tool's own sign-in and never reads their tokens (D-006).

## 2. Dev runs never touch real saves

| Command | Data folder | Use it for |
|---|---|---|
| `npm run dev` | `.dev-data/` (gitignored, kept between runs) | everyday development |
| `npm run dev -- --fresh` | `.dev-data/`, wiped first | testing a true first run (hatching, setup wizard) |
| `npm run dev -- --data <dir>` | any folder | keeping several test states |
| `npm start` | `%APPDATA%\Tama`, **your real Tamas** | only when you mean it |

A dev run has its own Electron profile, so it can run next to an installed Tama. `npm run dev` also skips the
old kero-pet import (`TAMA_NO_LEGACY=1`). The debug variables in [AGENTS.md §6](AGENTS.md#6-commands) pass
through, e.g. `TAMA_DEBUG=1 npm run dev` or `TAMA_OPEN_SETTINGS=1 npm run dev`.

## 3. Find your way around

```
src/main/        Electron main process (Node)
  index.js         bootstrap: wires everything together
  bus.js           the in-process message bus; topics are declared in bus-topics.js
  platform/        the only place that touches Electron and the OS (windows, tray, storage, secrets, logs)
  services/        app logic without Electron: pet, roster, events, memory, google, telegram, voice, usage…
  brain/           chat, composer, persona, PermissionGate
  engines/         Claude Code (Agent SDK) and agy (ACP) adapters
  providers/       picks the engine for each capability (chat, compose, json, code)
  channels/        IPC to the windows (desktop) and others
src/preload/     the window.tama bridge
src/renderer/    one folder per window (pet, terminal, chat, settings, setup…): views only, no logic
src/shared/      pure code used by both sides (character rig, palette, theme)
assets/          data: event deck, voice names, rig parts
scripts/         check, arch, coverage, perf, changelog, doctor, dev
docs/            PRD (what), ARCHITECTURE (how), DECISIONS (why)
```

Read in this order: [ARCHITECTURE §1–§5](docs/ARCHITECTURE.md), the index of
[DECISIONS.md](docs/DECISIONS.md), then [AGENTS.md](AGENTS.md). The rules that most often catch new code:

- Only `src/main/platform/*` may import `electron`. Services must run in plain Node so they can be tested.
- Modules talk through the bus or each other's `index.js`, never deep imports. A new bus topic goes in
  `bus-topics.js` first.
- Renderers are views: they render state and send intents.
- Every tool approval goes through `brain/PermissionGate`. Secrets only via `platform/secrets`.

`npm run check` enforces most of these (see `scripts/arch-check.js`).

## 4. Making a change

1. **Branch:** milestone branches (`m12-shipping`, …) or `feat/<short-name>` / `fix/<short-name>` from the current one.
2. **Code + tests:** `node:test` files next to the module (`*.test.js`). Services, migrations, router and
   PermissionGate need tests. Use `TAMA_DATA_DIR` (or `npm run dev`) for anything that runs the app.
3. **Check:** `npm run check` (types + architecture + tests) must pass. Optionally `npm run coverage`, and
   `npm run perf` if you touched animations or timers.
4. **Docs, in the same commit:**
   - `CHANGELOG.md`: a line under `## [Unreleased]`, then `npm run changelog`.
   - `docs/DECISIONS.md`: a new entry if you chose between real alternatives (criteria at its top).
   - `docs/PRD.md` requirement status and `docs/ARCHITECTURE.md` if structure changed.
5. **Commit:** conventional commits, e.g. `feat(pet): …`, `fix(voice): …`, `docs(decisions): add D-064`.
   Plain, professional text (the cute voice is for the UI only). Never commit `secrets.bin`, `.env`, tokens or saves.
6. **Pull request** into the milestone branch, with the PRD IDs (e.g. `SUM-1`) and decision IDs in the description.

Using an AI coding tool? `AGENTS.md` is its rulebook, and `CLAUDE.md` loads it for Claude Code automatically.

## 5. Build and release

```
npm run dist             # Windows installer: dist/Tama-Setup-<version>.exe (NSIS, per-user)
npm run dist:portable    # portable exe: dist/Tama-<version>-portable.exe
```

Test the build with a scratch folder: `set TAMA_DATA_DIR=%TEMP%\tama-test` then run `dist\win-unpacked\Tama.exe`.
Builds are unsigned (D-058), so Windows shows "unknown publisher".

**Releasing** (versioning in D-015, D-058):

1. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [x.y.z] — YYYY-MM-DD` and bump `version` in `package.json`.
2. `npm run check`, then commit `chore(release): x.y.z`.
3. Merge the milestone branch into `main`, then `git tag vx.y.z` and `git push origin main --tags`.
4. `npm run changelog`, then commit and push the regenerated table.
5. `npm run dist`, then publish the GitHub release with the installer:
   `gh release create vx.y.z dist/Tama-Setup-x.y.z.exe --title "Tama x.y.z" --notes-file <notes.md>`

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `Electron failed to install correctly` | `npm run setup` (or `node node_modules/electron/install.js`) |
| `claude`: "running scripts is disabled on this system" (PowerShell) | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or run `claude.cmd` |
| A tool was just installed but Tama doesn't see it | Setup wizard → "Check again" (no restart needed), or `npm run doctor` |
| Hotkeys don't work in a dev run | An installed Tama already uses them. Quit it, or use the tray menu |
| Chat says agy is missing | Install agy, or Settings → Brains → let Claude chat |
| Something crashed | Logs are in `<data folder>/logs/tama-YYYY-MM-DD.log` (Settings → Open logs) |
