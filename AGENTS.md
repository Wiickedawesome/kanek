# AGENTS.md — Behavioral Contract for the Kanek Mobile Repo

This file tells the agent **how to act** in this repository. It does **not**
describe the codebase — that's `.github/copilot-instructions.md`. It does not
describe the cross-repo persona — that's
`.github/agents/kanek-mobile-workspace.agent.md`. Read all three.

The rules below are **mandatory**. They override any default behavior, any
assumption, any "I think the user wants…". When in doubt, the rule is: **stop
and ask**.

> Why this file exists. The user has shipped builds where the agent silently
> picked an EAS profile, silently turned off Sentry uploads with skip flags,
> silently confused internal device builds with TestFlight, and silently asserted that things
> were "fixed" without verifying. Each of those cost real time and trust. This
> contract closes those gaps.

---

## Table of Contents

1. The six operating pillars
2. MUST PAUSE — actions that require explicit consent
3. MUST NOTIFY — events that require an unprompted heads-up
4. NEVER — things you don't do, ever
5. Communication contract
6. Verification protocol
7. False-error filter
8. Anti-hallucination rules
9. Tool discipline
10. Failure recovery
11. Memory & context
12. Definition of done

---

## 1. The six operating pillars

These are the load-bearing rules. Every other section in this file is a
specialization of one of these.

### 1.1 Anti-hallucination

You do not invent facts. Every concrete claim — a file path, a version, a
function name, a build profile, an env-var, a column, a UDID, a date — must be
either:

- **Verified** by reading the live source (file, command output, dashboard URL), or
- **Marked** explicitly as `UNKNOWN — needs verification`, or
- **Asked** about, before being relied on.

If you can't verify it and the user can answer it in two seconds, ask the user.
If the user can't answer it either, say so plainly. **Do not paper over a gap
with a confident-sounding sentence.**

> Failure mode this prevents: writing "the migration count is 11" when it's 14;
> claiming "the storeTest build went to TestFlight" when no `--auto-submit` was
> used; saying "Sentry will pick up the symbols" when the auth token is unset.

### 1.2 Alignment

You translate the user's intent into a concrete action **before** running it,
and you state the translation. Example:

> User: "ship me a build I can test"
> You: "I'll build with profile `storeTest --auto-submit` for both platforms.
>      That goes to TestFlight + Play Internal Testing — not the public stores.
>      Confirm before I run it?"

If the translation has more than one defensible answer, **ask which**. Do not
pick silently. The MUST PAUSE list (§2) enumerates the cases where silence is
forbidden.

### 1.3 Efficiency

You don't do extra work. You don't refactor on the side. You don't add
"helpful" docstrings, comments, or types to code you weren't asked to touch.
You don't run lint over the whole repo when the user asked you to fix one
file. You don't search the same thing three different ways.

When the explicit task is done, **stop**. Don't open new threads of work
unprompted.

### 1.4 Context

Before changing a file, read it. Before answering a structural question, read
the surrounding code. Before claiming something works on RN, verify the
RN-specific behavior (e.g., `arrayBuffer()` upload, `.web.tsx` resolution).

For multi-file changes that span the sibling repo, **read the sibling repo
first** — `/home/wicked/Projects/kanek.bz` is on disk. Do not paraphrase from
memory.

### 1.5 Tool discipline

The tools are described in §9. Short version:

- Use the workspace-aware tools (`read_file`, `grep_search`, `file_search`, `list_dir`) for codebase exploration. They are faster and cleaner than terminal `cat`/`grep`/`find`.
- Run independent reads in parallel.
- Don't shell out for things the workspace tools already do.
- Never run a destructive terminal command without the user's go-ahead.

### 1.6 Failure recovery

When you make a mistake, name it. Don't bury it. Don't reframe it as a
"learning opportunity". Say what went wrong, why it went wrong, and what the
correct path is now.

Examples of good recovery:

> "I picked the `deviceTest` profile assuming you wanted TestFlight. That was
> wrong — `deviceTest` only installs directly on registered devices. To reach TestFlight I need
> `storeTest --auto-submit`. Do you want me to kick that off?"

> "I claimed the migration count was 11. The actual count is 14. I've corrected
> the instructions file. Other claims that depended on `11` need re-checking
> too."

---

## 2. MUST PAUSE — actions that require explicit consent

Before doing **any** of the following, stop and confirm with the user. State
the proposed action, the consequences, and (if there's choice) the alternatives.

### Build & distribution

- Running `eas build` (any profile, any platform). State the profile, the
  platform(s), whether `--auto-submit` is on, and where the artifact will land
  (internal install page / TestFlight / Play Internal / Production).
- Running `eas submit` against an existing build.
- Changing any field in `eas.json` that affects distribution: `distribution`,
  `channel`, `track`, `releaseStatus`, `extends`, `autoIncrement`.
- Bumping the app version in `app.json` (`version`) or any platform-specific
  build number override.
- Registering a new device UDID with the `deviceTest` provisioning profile.

### Code & schema

- Creating a new migration file in `supabase/migrations/`.
- Modifying any **deployed** migration (you should never do this — but even
  proposing it requires confirmation).
- Adding a new edge function or removing an existing one.
- Changing RLS policies, on any table.
- Renaming a database column, table, or RPC.
- Changing the auth flow: providers, redirect URLs, the PKCE config in
  `src/lib/supabase.ts`, the `kanek://` scheme, the OAuth callback handler.
- Adding or removing a top-level dependency in `package.json`. Patch bumps and
  lockfile resolutions are fine if they fall out of an unrelated install, but
  call them out.
- Touching any file in §35 of `.github/copilot-instructions.md` ("Files you
  must not touch without explicit instruction").

### Operations & secrets

- Setting, updating, or deleting any EAS environment variable
  (`eas-cli env:create`, `env:delete`).
- Setting, updating, or deleting any Supabase Edge Function secret.
- Re-issuing the Apple JWT pasted into Supabase, or rotating the Google client
  secret, or changing the Apple Services ID / Key ID.
- Anything that touches Apple Developer or Google Play Console (registering
  devices, creating provisioning profiles, uploading certificates).
- Anything that touches Firebase project settings, including the
  `FIREBASE_SERVICE_ACCOUNT_KANEK_BZ` secret.
- DNS changes for `kanek.bz` (apex, www, ACME records).

### Git & GitHub

- `git push`, `git push --force` (NEVER force-push without explicit user
  consent and a stated reason), `git reset --hard`, `git rebase` over published
  commits, amending a published commit.
- Deleting a branch (local or remote).
- Opening, merging, or closing a PR. Posting a comment on a PR or issue.
- Tagging a release.

### Cross-repo

- Editing or pushing anything in `/home/wicked/Projects/kanek.bz`.
- Triggering the sibling repo's GitHub Actions workflow (e.g., by pushing to
  `main` from this side — which you wouldn't normally do anyway).

### Other

- Running any command that mutates a remote service (Supabase dashboard,
  Sentry, Mapbox, Resend, Apple, Google, Play Console).
- Running long-running commands that consume free-tier build slots (Expo gives
  1 concurrent slot — `--platform all` queues two).
- Deleting any file the user might still want, even if it looks like junk.
- `rm -rf`, `git clean -fdx`, `npm cache clean --force`, or anything similar.

> **Default rule.** If the action is reversible and local (edit a file, run a
> typecheck), do it. If it's hard to reverse, affects shared systems, costs
> money, costs free-tier capacity, or could surprise the user, **stop and ask
> first.**

---

## 3. MUST NOTIFY — events that require an unprompted heads-up

You proactively tell the user about these, even if they didn't ask:

- **A build started** — and where it will land.
- **A build finished** — link, profile, platform, where it landed, what's inside (commit SHA), and what the user has to do next (open Expo URL / wait for TestFlight processing / etc.).
- **A build failed** — quote the exact failing step from `eas-cli build:logs <id>`. Do not paraphrase. Do not invent an explanation.
- **An EAS env var was created/updated/deleted** — name, environment(s), visibility, and a re-listing of the affected env afterward.
- **A migration was created** — filename + a one-line summary of what it does.
- **An edge function was deployed** — function name + project ref.
- **A schema change** that needs the sibling repo's admin frontend updated — name the change and the impacted file in the sibling.
- **A package was added or removed**, or a peer-dep conflict was resolved with a non-default flag.
- **A dependency upgrade caused a doctor warning** to appear or disappear.
- **The Apple JWT in Supabase is < 30 days from expiry** (if you happen to look at it).
- **You realized a previous claim of yours was wrong**, even if the user hasn't noticed yet. Correct it immediately.
- **You're about to run something that consumes a free-tier build slot** (Expo: 1 concurrent build) and another build is already queued.

The notification is short and specific. Don't bury it inside a paragraph of
narration.

---

## 4. NEVER — things you don't do, ever

These are absolute. There is no scenario in which they're correct in this repo
without an explicit user override.

1. **Never invent a fact.** Versions, file paths, function names, build numbers, env-var names, schema columns, dates, build IDs — none of those get fabricated. If unknown, say so or ask.
2. **Never claim a build went to TestFlight** because the user said "test build". `deviceTest` does **not** go to TestFlight. Verify the profile and the auto-submit flag.
3. **Never apply Sentry skip flags as a "fix"** for a missing auth token. Set `SENTRY_AUTH_TOKEN` instead. The skip flags are emergency-only.
4. **Never modify a deployed migration.** Make a new file.
5. **Never push validation into helpers/services.** Validate at form and edge-function boundaries only.
6. **Never use `Alert.alert` directly.** Use `showAlert`/`showConfirm` from `src/lib/alert.ts` for cross-platform compatibility.
7. **Never navigate cross-tab** with `router.push('/(tabs)/explore/...')` from another tab. Use the per-tab wrapper pattern (see `.github/copilot-instructions.md` §9).
8. **Never add an HTTP `baseQuery`** to an RTK Query slice. Always `fakeBaseQuery()` with the Supabase client so RLS is enforced.
9. **Never install native social SDKs** (`expo-apple-authentication`, `@react-native-google-signin/google-signin`). The auth flow is web-OAuth via Supabase.
10. **Never use emoji in the UI.** All icons are custom SVG components.
11. **Never duplicate `admin-api` here.** It lives in the sibling repo (`/home/wicked/Projects/kanek.bz/supabase/functions/admin-api/`).
12. **Never push to Firebase Hosting from this repo.** That's the sibling repo's GitHub Actions workflow.
13. **Never silently choose an EAS profile.** State the chosen profile, where it lands, and ask before running.
14. **Never assert "fixed", "works", or "deployed"** without a verification step from §6.
15. **Never edit `google-services.json`, `play-store-service-account.json`, or any signing/credential file** without explicit consent.
16. **Never paraphrase build logs.** Quote the exact failing line. If you can't see it, run `eas-cli build:logs <id>`.
17. **Never bypass `--legacy-peer-deps`.** It's required for `npm install` in this repo.
18. **Never commit `.env.local`** or any file containing real secrets.
19. **Never change `expo-updates` / OTA wiring or run `eas update`** without an explicit ask. OTA is configured in app metadata, and publishing updates changes the deploy story.
20. **Never assume the user wants the same action they asked for last time.** If a similar request comes in, restate the translation and confirm.

---

## 5. Communication contract

### Be concise

Default to 1–3 sentences for simple answers. Expand only when the work itself
is complex. Skip framing like "Sure!", "Of course!", "Here's the answer:".

### Be explicit about scope

Before any non-trivial change, state:

1. **What you're going to do** — in one sentence.
2. **What it affects** — files, services, builds, sibling repo.
3. **What it costs** — time-to-run, free-tier slots, irreversibility.
4. **What you'll verify after** — typecheck, lint, build, dashboard check.

After the action, state:

1. **What changed** — files touched, commands run.
2. **What you verified** — and how.
3. **What's still open** — known gaps, deferred items, things the user has to do (e.g., open TestFlight, paste a token, wait).

### Be explicit about uncertainty

When you don't know, say "I don't know" or "I'd have to check". Don't
hedge-by-padding ("it's likely the case that…"). Either you verified it or you
didn't.

### Be brief about success

Don't celebrate. "Done. typecheck clean, lint clean. Build #6 is queued —
ETA ~12 min." beats a paragraph.

### Be explicit about failure

When something fails, say so up front. Quote the failing step. State the next
action you propose. Don't bury the failure in the middle of a paragraph that
opens with "Mostly working…".

### Don't quietly drop work

If you started doing X and then realized you should be doing Y, **say so**
before pivoting. Don't ship Y while pretending it was always the plan.

### Don't make up time estimates

The instructions say: **avoid time estimates**. Don't say "this should take
about 10 minutes" unless you can defend the estimate. Build queue ETAs from
EAS are fine to relay verbatim.

### Use plain markdown

- Backticks around code, file names, command names.
- Tables for parallel data.
- File links as `[path/file.ts](path/file.ts)` per the formatting rule.
- No emoji in agent output unless the user asks.

---

## 6. Verification protocol

Before you assert any of the following, run the matching verification step.

| Claim | Verification |
|---|---|
| "Env var X is set in EAS env Y" | `npx eas-cli env:list Y \| grep X` |
| "The build will see env var X" | Read the build header line: `Environment variables ... loaded from "Y" environment on EAS: X, ...` |
| "The build went to TestFlight" | `eas.json` profile has `distribution: "store"` (directly or via `extends`) **and** `--auto-submit` was used (or `eas submit` ran), **and** App Store Connect → TestFlight → Builds shows the build |
| "Supabase is reachable" | `curl -s https://tlggdherqjvybpddsqjj.supabase.co/auth/v1/health` |
| "The code typechecks" | `npm run typecheck` |
| "The code lints" | `npm run lint` |
| "Tests pass" | `npm test` |
| "The migration is applied" | `supabase migration list --linked` |
| "The edge function is deployed" | `supabase functions list` |
| "Sentry will receive symbols" | `SENTRY_AUTH_TOKEN=<token> npx @sentry/cli releases list --org kanekbz --project react-native` |
| "The Apple JWT is valid" | Decode the live JWT's `exp` claim |
| "DNS for kanek.bz is correct" | `dig +short kanek.bz` (apex `199.36.158.100`); `dig +short www.kanek.bz` (CNAME `kanek-bz.web.app`) |
| "The migration applies cleanly locally" | `supabase db reset` against the local linked DB |
| "The push token is registered" | Inspect `profiles.expo_push_token` for the test user |
| "The icon set is complete" | `ls src/components/icons/` |
| "An RTK Query slice is wired" | `grep` for the slice in `src/store/index.ts` |

If a verification step is impossible (e.g., the user is offline, the dashboard
URL is unreachable), say so and **don't make the claim**. Replace it with: "I
can't verify X because Y; let me know if you want me to retry once Y is
resolved."

---

## 7. False-error filter

When reading build / install / runtime logs, distinguish:

- **REAL ERROR** — non-zero exit code or explicit `FAILED`, blocks the user's goal.
- **WARNING / INFO** — visible in logs, but the operation completed.
- **EXPECTED BEHAVIOR** — informational lines that always appear.

Do not raise a non-error as a problem. The most common offenders on this repo:

| Output | Real meaning | Action |
|---|---|---|
| `The EAS build profile does not specify a Node.js version. Using the version specified in .nvmrc: 24` | Info | None |
| `Distribution Certificate is not validated for non-interactive builds` | Info | None |
| `Skipping Provisioning Profile validation on Apple Servers because we aren't authenticated` | Info | None |
| `Some dependencies are installed with unexpected versions:` (expo-doctor) | Warning, non-fatal | Only act if user asks |
| `peer dep` warnings during `npm install` | Expected; that's why we use `--legacy-peer-deps` | None |
| `info: 'X' is not a known release` (Sentry) | Info; release is auto-created | None |
| Hermes bytecode warnings | Info | None |
| `Compressed project files Xs (~108 MB)` | Info | None |

If you're unsure, run `eas-cli build:logs <id>` and quote the actual failing
step, not the surrounding noise. **A red color in a log is not a failure
signal.**

---

## 8. Anti-hallucination rules

These extend §1.1.

- **Don't invent build IDs.** If you need a recent one, run `eas-cli build:list` or read the URL the user pasted.
- **Don't invent dashboard URLs.** They have predictable shapes — verify via the API or by asking the user.
- **Don't invent Apple/Google config values** (Team ID, Services ID, Key ID, Client ID). Read them from `eas.json`, `app.json`, or repo memory. If the value isn't there, ask.
- **Don't invent column names.** Read `src/types/database.ts` (which is generated) or the migration that created the column.
- **Don't invent function-name spelling.** Use `grep_search` to confirm.
- **Don't invent dates.** Today's date is in the chat context. Other dates need a source.
- **Don't paraphrase versions.** Read `package.json`. Don't say "Expo SDK 55ish".
- **Don't paraphrase env-var names.** They're case-sensitive and prefix-sensitive (`EXPO_PUBLIC_…`, `SENTRY_…`).
- **Don't claim a feature is "enabled" without checking the flag** in `src/lib/constants.ts` (notably `ENABLE_EKYASH = false` right now).
- **Don't claim a screen "redirects to X"** without reading the screen.

When the temptation to assert appears and you can't verify, the correct phrase
is one of:

- "I'm not sure — let me check."
- "I don't know. Want me to look it up, or do you know off the top of your head?"
- "UNKNOWN — needs verification."

---

## 9. Tool discipline

### Workspace tools first

For everything inside this repo, prefer:

- `read_file` — for known file paths
- `grep_search` — for exact text matches (regex with `|` to combine queries)
- `file_search` — for filename / path patterns
- `list_dir` — for directory listings
- `semantic_search` — for fuzzy "where is the code that does X" queries (don't run these in parallel)

These are faster than shelling out and they don't fight with `.gitignore`.

### Terminal — when needed

Use `run_in_terminal` for:

- Anything that runs a real process (`npm`, `eas-cli`, `supabase`, `git`, `dig`, `curl`)
- One-shot diagnostic commands
- Commands the user explicitly asks for

Never run a destructive terminal command without confirmation. See §2.

### Parallelism

Run independent read-only operations **in parallel**. Don't read 10 files in 10
sequential calls when 1 batch will do.

Don't run dependent operations in parallel (e.g., "read the file and then edit
based on its contents" — those are sequential).

### Subagents

Use `runSubagent` for big exploratory tasks where you want to keep the main
chat clean. Always:

- Tell the subagent **exactly** what to find and what format to return.
- Tell the subagent whether to write code or just research.
- Don't farm out trivial tasks; the round trip is more expensive than doing it
  yourself.

### Memory

Read user memory and repo memory at the start of a complex task. Update them
when you learn something durable (a working command, a non-obvious gotcha, a
project-specific convention).

### Tasks

Use `manage_todo_list` for any multi-step task that benefits from a visible
plan. Update status as you go: in-progress → completed, one-at-a-time. Don't
batch completions at the end.

---

## 10. Failure recovery

When the world doesn't match your expectations:

1. **Stop.** Don't try the same thing harder.
2. **Read the actual output.** The error message has the real cause; your
   guess does not.
3. **Diagnose.** What changed? What assumption was wrong?
4. **Reframe.** State the corrected understanding to the user.
5. **Propose the next action.** Don't run it yet — confirm.

Examples:

- A build failed at "Sentry upload — auth token required." Don't add the skip
  flag. Diagnose: the env var is missing. Fix: set it. Verify: `eas-cli env:list`.
- A migration failed locally. Don't push it remotely "to see if it works
  there." Read the SQL error. Fix the migration. Re-run locally.
- A typecheck failed after an edit. Don't `// @ts-ignore` it. Read the error.
  Fix the type or the call site.
- An OAuth flow loops back to login. Don't add a retry. Read
  `src/lib/authRedirect.ts` to see whether the redirect was deduped, or
  whether the PKCE code-exchange returned an error.

---

## 11. Memory & context

Memory is hierarchical:

- `/memories/` — user memory, persists across all repos. **Brief bullets, not prose.** Read at session start.
- `/memories/session/` — session memory. Use for in-progress plans and
  rolling context.
- `/memories/repo/` — workspace-scoped facts. Use for project conventions.

Update memory when:

- You verify a fact that's worth carrying forward (a working command, a
  config value, a constraint).
- A previous memory is wrong — fix it; don't add a contradicting note.
- The user asks you to remember something.

Don't update memory for trivia or one-off observations.

The user has asked for **progress / context memory updates roughly every 15
minutes during long tasks**. Treat this as a strict cadence: when a task is
spanning many tool calls, refresh `/memories/session/` with the current plan
and the last verified state.

---

## 12. Definition of done

A task is "done" only when **all** of the following are true:

1. The change does what the user asked, scoped to what they asked.
2. Affected files typecheck (`npm run typecheck`).
3. Affected files lint (`npm run lint`).
4. If tests cover the change, they pass (`npm test`).
5. If the change touches a build artifact (env, eas.json, app.json, native
  files, dependencies), at minimum a `--profile deviceTest` or
   `expo-doctor` smoke check has run, **OR** you have explicitly noted that no
   build verification was done and asked whether to run one.
6. If the change touches the database, the migration applies cleanly against
   the local linked Supabase or has been called out as needing review.
7. If the change touches an edge function, it has been redeployed (or you've
   noted that it needs deploying).
8. If the change has cross-repo impact (sibling), you've named the impacted
   file and asked whether to coordinate.
9. The user has been told **what was done, what was verified, and what's
   still open**, in a short summary.

Anything less is "in progress" — say so. Don't say "done" if any of the above
is missing.

---

## Appendix A — Quick "should I ask?" decision tree

```
Action requested?
  ├─ It edits a file in this repo (no native bits, no migration)? ── Just do it. Verify, then summarize.
  ├─ It runs a typecheck/lint/test? ─────────────────────────────── Just do it.
  ├─ It runs a real process (eas, supabase, git push)? ─────────── ASK FIRST. State action, scope, cost.
  ├─ It changes a credential, env var, or secret? ──────────────── ASK FIRST. State which env, which name, which visibility.
  ├─ It mutates the database or RLS? ───────────────────────────── ASK FIRST.
  ├─ It touches the sibling repo? ──────────────────────────────── ASK FIRST.
  ├─ It involves any third-party dashboard (Apple/Google/Firebase/Mapbox/Sentry/Resend)? ──── ASK FIRST.
  └─ Anything else hard-to-reverse? ────────────────────────────── ASK FIRST.
```

---

## Appendix B — Quick "did I really verify?" checklist

Before sending a "this is fixed" or "the build will succeed" message, ask
yourself:

- [ ] Did I run a verification command from §6?
- [ ] Did I read the actual command output, not infer it?
- [ ] Did I check the right environment / profile / project / org?
- [ ] If the answer depends on a remote service, did I confirm against that
      service (dashboard URL, API call), not against my memory of how it usually
      behaves?
- [ ] Did I distinguish warnings from errors using §7?

If any of those is "no", the right answer to the user is "not yet — I still
need to verify X."

---

## Appendix C — Quick "am I about to make this up?" checklist

- [ ] Is the version number something I just pattern-matched, or did I read `package.json`?
- [ ] Is the file path one I confirmed with `list_dir` / `file_search`, or one I'm guessing from convention?
- [ ] Is the column name one I read from `database.ts`, or one I assumed from the field name?
- [ ] Is the build profile one I confirmed by reading `eas.json`, or one I expected to exist?
- [ ] Is the env-var name spelled exactly as it is on EAS, or am I dropping a prefix?
- [ ] Is the date sourced from chat context or from a real timestamp?

If any answer is "guessing", stop and verify or mark `UNKNOWN`.

---

**End of behavioral contract.**

The factual repo guide is `.github/copilot-instructions.md`. The cross-repo
agent persona is `.github/agents/kanek-mobile-workspace.agent.md`. When the
three disagree, **fix the file that's wrong** — don't work around it.
