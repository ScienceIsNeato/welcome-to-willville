# Slop-Mop in `welcome-to-willville`

This repo uses [slop-mop](https://github.com/ScienceIsNeato/slop-mop) (`sm`) as
the one-and-only quality-gate runner. Slop-mop wraps the linters, type
checkers, test runners, security scanners, and PR-feedback tooling we would
otherwise run by hand. **You should not run `eslint`, `tsc`, `jest`,
`prettier`, `npm test`, or `gh pr ...` directly in this repo** — `sm` already
knows how to invoke them, caches results, and tells you what to fix next.

## TL;DR

```bash
sm swab           # run before every commit (fast)
sm scour          # run before opening / pushing a PR (thorough)
sm sail           # "I don't know what's next" — sm picks the right verb
sm doctor         # something feels off — diagnose the environment
sm help           # list gates; `sm help <gate>` for details
sm barnacle file  # slop-mop tool itself is wrong / blocking — file upstream
```

The maintenance loop:

```
edit → sm swab → fix → repeat        (until swab is clean)
       sm scour → fix → repeat       (until scour is clean)
       git push
       sm buff watch <PR#>           (block until CI settles)
       sm buff <PR#> → fix → repeat  (until CI + threads clean)
```

## Hard rules

> **NEVER use `--no-verify` or any bypass flag.** Period.
> Ask for help if you become incapable of getting quality gates to pass
> without cutting corners. — _user-level rule_

The same applies to disabling individual gates as a "workaround", weakening
thresholds in `.sb_config.json` to dodge a failure, or running raw `eslint
. --fix && git commit` to sneak past `sm`. If a gate is genuinely wrong,
tune it intentionally and document why; if `sm` itself is misbehaving, run
`sm barnacle file` to send the friction report upstream.

## What's installed

| Artifact         | Path                                                            | Notes                                                                                                                                   |
| ---------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `sm` CLI         | `/Users/pacey/.local/bin/sm` (pipx, slopmop 1.2.0)              | Installed user-globally; resolved via `PATH`.                                                                                           |
| Live config      | `.sb_config.json`                                               | Effective gate configuration. Edit this.                                                                                                |
| Template config  | `.sb_config.json.template`                                      | Pristine slop-mop defaults. Useful diff target.                                                                                         |
| Cursor rule pack | `cursor-rules/` (with `.cursor → cursor-rules/.cursor` symlink) | Provides the always-applied `slopmop-swab.mdc` / `slopmop-scour.mdc` / `slopmop-buff.mdc` / `slopmop-sail.mdc` rules. Already wired up. |
| Pre-commit hook  | _(not installed yet)_                                           | See "Pre-commit hook" below.                                                                                                            |

`sm` is a `pipx` install, so the lifecycle is `pipx upgrade slopmop` or
`sm upgrade`. There is no project-local `./sm` runner and there is no
`venv/` in this repo.

## Gates that run in this repo

`sm status` is the source of truth for what's wired in today. Re-run it any
time the config or codebase shape changes. As of this writing:

### Active in `sm swab` (every commit)

Foundation gates — must pass:

- `laziness:sloppy-formatting.js` — ESLint + Prettier on the JS/TS sources.
  ⚠️ This repo has no `.eslintrc*` or `.prettierrc*` yet, so the first run
  will need either a config or a deliberate skip decision.
- `overconfidence:type-blindness.js` — `tsc --noEmit` against `tsconfig.json`.
  Already passes.
- `overconfidence:untested-code.js` — `npx --yes jest --ci --coverage`.
  No tests exist yet; expect this to fail loudly until either Jest is
  configured + a first test lands, or the gate is intentionally skipped
  during `sm refit` (see below).
- `overconfidence:coverage-gaps.js` — depends on the JS test gate above.
- `deceptiveness:bogus-tests.js` — passes while there are no tests.

Cross-cutting (language-agnostic) gates — also active:

- `laziness:dead-code.py` (vulture; no Python source → expected no-op)
- `laziness:debugger-artifacts` (greps for `debugger;`, `pdb.set_trace`, etc.)
- `laziness:repeated-code` (jscpd source duplication)
- `myopia:code-sprawl` (max file 1000 lines, max function 100 lines)
- `myopia:string-duplication.py` (Python only; no-op here)
- `myopia:ambiguity-mines.py` (Python only; no-op here)
- `myopia:vulnerability-blindness.py` (bandit / semgrep / detect-secrets;
  semgrep will still scan the JS/TS tree for generic patterns)
- `laziness:broken-templates.py` (Jinja2 validation; no-op here)
- `laziness:sloppy-formatting.py` (autoflake/black/isort; no-op on no Python)
- `overconfidence:untested-code.py` and `overconfidence:coverage-gaps.py`
  — **currently FAIL** because there are no `test_*.py` files in `tests/`.
  This is the headline refit decision (see below).

### Active in `sm scour` only (pre-PR)

- `myopia:just-this-once.py` — Python diff coverage (will skip/fail same way
  as the other Python coverage gate today).
- `myopia:dependency-risk.py` — pip-audit + scanners.

### Auto-skipped (no action needed)

slop-mop skips these because the project doesn't have the relevant markers:

- All `*.dart` gates (no `pubspec.yaml`).
- `overconfidence:missing-annotations.py` (no Python source dirs).
- `laziness:complexity-creep.py` (no Python source).
- `deceptiveness:hand-wavy-tests.js` (no JS test files yet).
- `laziness:sloppy-frontend.js` (no `frontend_dirs` set in `.sb_config.json`;
  we may opt into this gate once the `app/` layout stabilizes).
- `myopia:github-actions-hygiene` (no `.github/workflows/*`).
- `myopia:interactive-assumptions` (no shell scripts / Dockerfiles / CI).
- `deceptiveness:bogus-tests.py` (no Python tests).
- `myopia:ignored-feedback` (skips when not on a PR branch; activates in
  `sm scour` when a PR is open).

### Intentionally disabled in `.sb_config.json` (deviations from template)

These are off in the live config and would need an explicit refit decision
to re-enable:

- `deceptiveness:gate-dodging` — flags threshold weakening; off pending refit.
- `laziness:silenced-gates` — config-debt diagnostic; off pending refit.
- `myopia:ignored-feedback` — PR-comment gate; off until CI/PR flow stabilizes.

`sm doctor` will list these as "applicable gate(s) disabled and need an
explicit refit decision" until we either re-enable or formally record why
they stay off.

## Known transient: feature-code refit in flight

At the time of writing, this repo is mid-build (Mayor's Express + Canal
features). Expect `sm swab` / `sm scour` to fail because:

1. There are no JS tests yet, so `untested-code.js` / `coverage-gaps.js` fail.
2. There is no ESLint/Prettier config, so `sloppy-formatting.js` will
   demand one.
3. The Python coverage gates are still enabled and fail with
   `No Python test files (test_*.py or *_test.py) found in ['tests']`.

**Do not "fix" any of these by editing `app/`, `components/`, `lib/`, or
`functions/` while another agent is editing feature code.** The refit path
below is what unblocks `sm swab` for everyone.

## Refit path (one-time onboarding)

Once feature work has landed, walk through the refit rail:

```bash
sm refit --start      # generate a remediation plan
# fix one gate at a time
sm refit --iterate    # advance to the next gate
# ... repeat ...
sm refit --finish     # enter steady-state maintenance
```

Concrete decisions we'll need to record during refit:

1. **Python coverage gates** — either disable
   `overconfidence:coverage-gaps.py`, `overconfidence:untested-code.py`,
   `myopia:just-this-once.py` (and the related Python-only gates) for this
   project, or formally adopt them when Python tooling lands. Today they
   should just be off — this repo is TypeScript/Next.js only.
2. **JS lint/format config** — add `.eslintrc.json` (or `eslint.config.mjs`
   for flat config) and `.prettierrc` so `laziness:sloppy-formatting.js`
   has something to enforce. Next.js ships an ESLint preset.
3. **First test** — once a single Jest test file exists, the JS test/coverage
   gates flip from "no tests found" failure to a real pass/fail signal.
   We may want to tune `coverage-gaps.js`'s `threshold` (default 80) lower
   while coverage is still ramping.
4. **Frontend dirs** — populate `laziness:sloppy-frontend.js.frontend_dirs`
   (e.g. `["app", "components"]`) once we want the fast frontend ESLint
   pre-flight in `sm swab`.
5. **GitHub Actions hygiene** — when `.github/workflows/` is added, turn on
   `myopia:github-actions-hygiene` and pin actions to commit SHAs.
6. **PR feedback gate** — flip `myopia:ignored-feedback` on once the PR
   workflow is real.
7. **Refit-blocker gates** — re-enable or explicitly suppress
   `deceptiveness:gate-dodging` and `laziness:silenced-gates`.

## Pre-commit hook

Status today: **not installed.** Slop-mop ships its own hook installer
(`sm commit-hooks install`) which writes a `.git/hooks/pre-commit` that
runs `sm swab` and refuses bypass flags. Install it as soon as `sm swab`
is green on `main`:

```bash
sm commit-hooks status     # verify nothing is installed yet
sm commit-hooks install    # writes a pre-commit hook that runs `sm swab`
```

Installing it before refit completes would block every commit (including
the feature work in flight), so we wait. After install, the workflow is
just:

```bash
git add -A
git commit -m "..."
# ↑ hook runs sm swab automatically; commit aborts if any gate fails
```

If a hook ever appears to be misbehaving, **do not** reach for `--no-verify`.
Run `sm doctor` first, then `sm barnacle file --dry-run` to draft an
upstream issue.

## Cursor / agent integration

Cursor agents in this workspace already see the slop-mop discipline through
the `.cursor` → `cursor-rules/.cursor` symlink. The relevant always-applied
rules are:

- `cursor-rules/.cursor/rules/slopmop-swab.mdc` — substitution table; raw
  tooling → `sm` redirects.
- `cursor-rules/.cursor/rules/slopmop-scour.mdc` — pre-PR sweep.
- `cursor-rules/.cursor/rules/slopmop-buff.mdc` — post-submit CI / PR-comment
  triage.
- `cursor-rules/.cursor/rules/slopmop-sail.mdc` — auto-advance verb.
- `cursor-rules/.cursor/rules/sm_swab.mdc`, `sm_scour.mdc`, `sm_buff.mdc` —
  detailed per-verb guides.

We deliberately do **not** run `sm agent install --target cursor`; that
would drop duplicate `.cursor/rules/slopmop-*.mdc` files under
`.slopmop/tmp/` (a gitignored temp area) and bypass the cursor-rules clone
that already owns these rules. Other agent runtimes (Claude Code,
Copilot, etc.) can be on-boarded with `sm agent install --target <runtime>`
when needed.

## Adding new gates as the codebase grows

`.sb_config.json` is hand-editable; pair changes with a short PR-body
justification. Common adds:

- New language toolchains → flip the corresponding language gate from
  `"enabled": false` to `"enabled": true`.
- Tighten coverage threshold → bump
  `overconfidence:coverage-gaps.js.threshold` once the suite stabilizes.
- Per-folder customization → use `include_paths` / `extra_exclude_paths`
  on each gate.
- Run `sm config --show` to see the resolved configuration after edits,
  and `sm help <gate>` for per-gate options.

For anything where slop-mop itself gives bad guidance, run:

```bash
sm barnacle file --dry-run   # preview a structured upstream issue
sm barnacle file             # actually file it (after review)
```

That's the canonical channel — don't fork the gate or work around it.

## Cheat sheet

```bash
# Daily loop
sm swab                                # fast, every commit
sm swab -g overconfidence:type-blindness.js   # re-check one gate
sm swab -g overconfidence:type-blindness.js -v  # verbose detail
sm sail                                # "do the next obvious thing"

# Pre-PR
sm scour                               # thorough; includes diff coverage,
                                       # security audit, PR comments
sm scour -o .slopmop/last_scour.json   # mirror structured output

# Post-push / CI triage
sm buff <PR#>                          # full PR triage
sm buff watch <PR#>                    # block until CI settles
sm buff status <PR#>                   # one-shot CI summary
sm buff resolve <PR#> <THREAD_ID> -m "fixed in commit <sha>"

# Refit (one-time)
sm refit --start
sm refit --iterate
sm refit --finish

# Diagnostics
sm doctor                              # environment + gate health
sm doctor --fix                        # clean up sm-owned state only
sm status                              # JSON dashboard (config, gates, workflow)
sm config --show                       # resolved configuration
sm help                                # list gates
sm help <gate>                         # detailed gate help
sm upgrade                             # bump slop-mop itself
sm barnacle file --dry-run             # file upstream tool-friction issue
```

## References

- slop-mop project: <https://github.com/ScienceIsNeato/slop-mop>
- Workflow state machine: <https://github.com/ScienceIsNeato/slop-mop/blob/main/DOCS/WORKFLOW.md>
- Gate reasoning: <https://github.com/ScienceIsNeato/slop-mop/blob/main/DOCS/GATE_REASONING.md>
- Cursor rules (this repo's `.cursor` symlink target): `cursor-rules/.cursor/rules/`
