# AGENTS.md (Image Canvas)

> Behavior rules for AI coding agents on this project.
> Project docs live in `README.md` and `CHANGELOG`.
>
> You **must** write in English only in `AGENTS.md`. (Conversational replies to the user match the user's active language, defaulting to Chinese; only this document is English-only.)

---

## §0. Multi-Agent Collaboration Protocol

### 0.1 Doc Edit Policy (read this first)

- **Do NOT modify `README.md` or `CHANGELOG` during feature work.** Finish the code first.
- **These docs are edited only when the user explicitly asks.** Phrasings that unlock doc edits: _"update the docs"_, _"sync the docs"_, _"prep for commit"_, _"fill in the changelog"_, or the `CCC` shortcut (§6). Without an explicit request, leave the docs alone.
- **After finishing any add / modify / delete coding task, ask the user** whether they want `CHANGELOG` and/or a git commit updated now. Don't do these silently, and don't just wait passively either — surface the question so the user can decide. **Tip:** mention the `CCC` / `3C` shortcut (§6) so the user can trigger all steps at once.
- **When the user does ask**, batch all deferred updates from the session into one coherent edit.
- **`AGENTS.md` (this file) changes only when the user asks to change a rule.** Feature work never touches it.
- **Ignore markdownlint warnings in Markdown docs.** Author content for clarity and correctness; leave style-only lint alone unless the user explicitly asks to fix it.

### 0.2 Git Commit Policy

- **All commit messages must be in English** (subject and body).
- Conventional commit format: `type(scope): description`
  - Types:
    - `feat`: A new user-facing capability.
    - `fix`: A bug fix in app logic, rendering, backend, or persistence.
    - `refactor`: Restructuring code with no behavior change.
    - `style`: Formatting-only changes (whitespace, semicolons).
    - `docs`: Documentation only (`README.md`, `CHANGELOG`, comments).
    - `chore`: Tooling, build config, dependencies, scaffolding.
    - `perf`: A measurable performance improvement.
    - `content`: Static copy or asset changes that carry no logic.
  - Scope: optional; pick the subsystem the change belongs to.
  - Description: imperative mood, lowercase, no trailing period.
- **Body: lead-in sentence + dense bullets.** Explain user-visible behavior, parameters, and architectural trade-offs. Wrap at ~72 columns.
- **Never add co-author trailers** (e.g. `Co-authored-by: ...`) to commit messages.
- **Atomic commits.** Each commit must represent one cohesive, self-contained logical change.
- When the user asks for a commit, **confirm the message and scope before executing.** Every commit must pass the pre-commit review confirmation in 0.4.
- **Commit status reporting.** When committing, report clearly in the user's active conversational language: 「本对话涉及到的文件已经全部提交，且不涉及冲突」 when clean, or 「本对话涉及到的文件已经全部提交，但目前出现了冲突」 when conflicts exist (then identify only the conflicting paths this session touched).

### 0.3 Collaboration Lifecycle

1. **Before coding**, read `README.md` for what the app does, and the central state module for how behavior flows.
2. **While coding**, keep the shared module as the only import used by both the frontend and the backend; keep user-facing copy in the designated text module (with its local override file) instead of hardcoding it in components.
3. **After coding**, **do not edit any docs immediately.** Keep a short list of what changed, then ask the user if they wish to sync docs and commit.
4. **Pre-commit doc sync (user-initiated only).** When asked, do all of:
   - Load the `changelog-principle` skill via the skill tool **before** editing `CHANGELOG`.
   - Update `CHANGELOG` ([Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) format, newest first, `YYYY-MM-DD` date). Entries describe the net user-observable result since the last sync — not one line per change, per file, or per commit, and never a transcription of commit subjects. Reworks of an unreleased feature edit the original entry in place; a bug introduced and fixed inside the same unreleased period folds into that feature's entry instead of getting its own `Fixed` line.
   - **Baseline rule:** before the first release, `CHANGELOG` must describe the app itself in terms a first-time reader can follow (what it is, core loop, main systems). An entry must never reference a concept the changelog has not already introduced.
   - Update `README.md` when commands, behavior, or setup steps changed.

### 0.4 Pre-Commit Review Confirmation

- **Before executing any `git commit`, ask the user for review confirmation via the interactive question-asking tool.** Batch all commits into one call when multiple commits are proposed.
- Question template (in the user's conversational language):

  ```plaintext
  该提交通过吗：
  {{commit message including body}}

  描述：{{short Chinese description of the change}}
  ```

- Options per question, in this order:
  1. `通过` — confirmation given; proceed with the commit.
  2. `不通过，暂缓提交` — rejected; do not commit, leave changes staged/unstaged as they are.
- Never commit without an explicit `通过` answer. If the user rejects, fix or wait as instructed — do not retry the same commit unprompted.

---

## §1. Role & Working Principles

You are an AI development partner on this codebase: build features, fix bugs, and refactor alongside the user.

- **Understand before changing.** Read the docs and the central state module first; most app behavior flows through it.
- **Respect boundaries.** The shared module is the only import both the frontend and the backend may use; user-facing copy stays in the text module so it can be overridden locally.
- **Prefer the smallest change that solves the task.** Do not expand scope beyond the current request.

---

## §2. Development Standards

### 2.1 Vue 3 & TypeScript

- **Vue 3 SFC + `<script setup lang="ts">` only.** No Options API.
- **Strict TypeScript.** No `var`, no `any` (use `unknown` + narrowing or explicit interfaces).
- **SFC filenames are PascalCase.** Root `App.vue` follows the same convention.
- **Inside Vue `<template>`, components MUST be referenced in PascalCase.**

### 2.2 State & Imports

- App-wide state lives in the central store; components never own it.
- Cross-directory imports go through the `@/` path aliases and each directory's barrel; the shared module is imported as `@shared`. Same-directory imports stay relative.
- Every directory keeps an `index.ts` barrel. Add new exports there instead of deep-importing from consumers.

### 2.3 Styling with Tailwind CSS v4

- Compose styled component parts with `@apply` inside `<style>` blocks; each block starts with a `@reference` to the global stylesheet (path relative to the file):

  ```vue
  <style>
  @reference "../styles.css";

  .some-component__part { @apply absolute bottom-1.5 left-1.5; }
  </style>
  ```

- Components use BEM-ish class names prefixed by the component (`block__element--modifier`), with modifier classes toggled through `:class` objects.
- Throwaway markup uses inline utility classes.

### 2.4 Verification

- **Without explicit user permission, run no verification other than type checking.** No browser testing (Playwright or otherwise), no dev-server runs, no render-timing experiments.
- **Type checking uses `pnpm typecheck`** (`vue-tsc --noEmit`); `pnpm build` additionally bundles and is the stricter end-to-end check.

---

## §3. Forbidden

- `var`.
- `any` — use `unknown` + narrowing, or a real type.
- Hand-editing runtime data directories — they are gitignored app state.
- Committing gitignored override files, or removing the fallbacks that keep the app working without them.
- Auto-installing dependencies without user confirmation.
- Co-author trailers in commit messages.

---

## §4. Skills

Load matching skills via the native skill tool when a task hits their domain:

1. `changelog-principle` — before editing `CHANGELOG`.
2. `humanizer-zh` / `humanizer` — when editing prose for the user.

---

## §5. Naming Conventions

- **SFC files & component references**: PascalCase (`UserProfile.vue`, `<UserProfile>`).
- **Types & interfaces**: PascalCase (`ImageRecord`, `SpawnOptions`).
- **Constants**: UPPER_SNAKE_CASE (`UPLOAD_TYPES`).
- **Store functions**: exported camelCase verbs (`setSelection`, `flushQueue`).
- **CSS classes**: `block__element--modifier`, prefixed by the component name.

---

## §6. Quick Commands

### 6.1 CCC / 3C

When the user inputs **`CCC`** or **`3C`**, execute in order:

1. **CHANGELOG** — Load the `changelog-principle` skill via the skill tool first, then write reader-facing entries following the §0.3 doc-sync rules: net user-observable diff since the last sync, baseline entry for a first-time reader, no commit-subject transcription (Keep a Changelog 1.1.0 format).
2. **CODEBASE** — Sync user-facing docs: update `README.md` when commands, setup steps, or user-visible behavior changed.
3. **COMMIT** — Confirm commit message and scope via review confirmation (0.4), then stage and commit.
