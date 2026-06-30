---
name: upstream-sync
description: Sync this tweb fork with upstream (morethanwords/tweb) — assess what changed upstream since the last sync point, decide what's worth porting, cherry-pick it in a worktree, and land it as a single squash commit on master. Use whenever the user asks "what changed upstream", "sync with upstream", "port/cherry-pick upstream changes", "check upstream for new commits", or wants to update the fork from the original tweb repo.
---

# Sync fork with upstream tweb

Standard procedure for pulling upstream tweb changes into this fork. The fork is heavily diverged, so this is never a plain merge — it's assess → selectively cherry-pick → squash-land.

## State & locations

| What | Where |
|---|---|
| Upstream clone | `~/repo/tweb` (fetch its `origin` for the latest `origin/master`) |
| Upstream as remote in this repo | `upstream` → `~/repo/tweb` (so `git fetch upstream master` brings objects in for cherry-picking) |
| Last synced upstream commit | `private/last-upstream-sync-commit` (single sha + newline). This is the range start for every sync; bump it to the new upstream tip at the end. |
| Port worktree | `.claude/worktrees/upstream-sync`, branch `upstream-sync` off `master` |

If the `upstream` remote is missing, add it: `git remote add upstream ~/repo/tweb`.

## Phase 1 — assess

1. Read the fork point: `cat private/last-upstream-sync-commit`.
2. `git -C ~/repo/tweb fetch origin`, then `git -C ~/repo/tweb log --format='%h %ad %s' --date=short <fork-point>..origin/master`.
3. Fan out assessment subagents (Explore), grouping commits by domain (media, chat UI, misc...). Each agent gets: upstream path, fork path, fork point, and its commit list. For each commit it must answer:
   - What does it do, and is it a real fix/feature or noise (build artifacts, version bumps)?
   - Are the touched files **unchanged in the fork** since the fork point (`git log <fork-point>.. -- <files>` in the fork)? Unchanged → clean cherry-pick. Diverged → estimate conflict surface by reading both sides, not by guessing from filenames.
   - Is it part of a chain? Later upstream commits often **supersede** earlier ones (e.g. a refactor replacing two point fixes) — port only the final form, skip intermediates. Dependencies the other way matter too (port prerequisites first).
   - Does it conflict **architecturally** with a fork mechanism (not just textually)? Those hunks must be dropped or reimplemented, not merged.
4. Report a verdict grouped as: **clean picks** / **port with adaptation** (with what the adaptation is) / **skip** (with why), plus a suggested port order. Wait for the user's go-ahead before porting.

## Phase 2 — port (in a worktree)

Work on a branch in a worktree so master and the user's uncommitted files stay untouched:

```bash
git fetch upstream master
git worktree add .claude/worktrees/upstream-sync -b upstream-sync master
cd .claude/worktrees/upstream-sync
```

Order: all clean picks in one batch (`git cherry-pick <sha> <sha> ...`), then adaptation ports easiest-first, respecting dependencies.

### Special cases

- **`src/scripts/out/langPack.strings`** is auto-generated from `lang.ts` and not tracked in the fork. If a pick conflicts on it: `git rm src/scripts/out/langPack.strings`, keep the `lang.ts` hunk, `git commit -c <sha> --no-edit`. Never hand-resolve that file.
- **Partial pick** (commit contains an incompatible hunk): `git cherry-pick -n <sha>`, drop the bad hunks (`git checkout --ours <file>` or hand-edit), then `git commit -c <sha> --no-edit` to keep upstream authorship/message.
- **Superseded-chain ports**: when skipping intermediates, call sites in the final commit may assume the intermediates' state — after resolving, grep for arguments/props that no longer exist and align with upstream's final file content (`git -C ~/repo/tweb show <sha>:<path>`).
- Predicted conflicts often don't materialize; actual cherry-picks are cheap. When a pick applies clean but touched diverged code, **verify integration points by hand** (new params threaded through all callers, helpers the fork already has vs. duplicates upstream added).

### Verify

- No leftover markers: `rg -l '^(<{7}|={7}|>{7})' src` must be empty.
- Typecheck from the worktree: `../../../node_modules/.bin/tsc --noEmit`. A fresh worktree lacks the gitignored `src/langPackLocalVersion.ts` — seed it: `cp src/langPackLocalVersion.example.ts src/langPackLocalVersion.ts` (do not commit).
- ESLint pass: `pnpm run lint --fix`. Our eslint config is a bit stricter than the upstream (and we have different formatting style), so you might need to fix some errors.

## Phase 3 — land

The user wants ports as **one plain squash commit on top of master** — no merge commit, no rebase of master (never rewrite the user's local commits):

```bash
cd <main checkout>
git merge --squash upstream-sync
git commit -m "port upstream changes <old-fork-point-short>..<new-upstream-tip-short>"
printf '<new-upstream-tip-full-sha>\n' > private/last-upstream-sync-commit
git worktree remove .claude/worktrees/upstream-sync && git branch -D upstream-sync
```

`<new-upstream-tip>` is upstream's `origin/master` head at assessment time (include even skipped commits in the range — the file records "assessed up to", not "ported up to").

Confirm with the user before landing on master; they may want to review the branch first.
