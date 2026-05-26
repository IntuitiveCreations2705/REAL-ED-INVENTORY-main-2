 
        # PUSH Command System (Reference + Pre-Action Query)

Use this as the standard recall file before any git commit/push/tag action.

Policy scope: applies to all branches (main, feature, hotfix, WIP).

Hard rule: commit + push + checkpoint tag are mandatory for each repo-changing action.

No-bypass rule: if any gate answer is N or unclear, stop work immediately.

## 1) Mandatory Pre-Action Gate Query (ask user first)

Copy/paste this block and get explicit answers before committing/pushing/tagging:

- Scope: **Code-only** or **Code + DB**?
- Branch target: confirm active branch (must apply gate on current branch, including WIP)
- Snapshot branches required: `stable-*`, `rollback-*`, `revert-*`?
- Any `--force-with-lease` required? (Default: **No**)
- Commit message text approved? (Y/N)
- Commit now? (Y/N)
- Push now? (Y/N)
- Create and push checkpoint tag now? (Y/N)
- Proceed now? (Y/N)

Execution rule: commit message approval plus all four action gates above must be **Y**. If any is **N**, do not proceed.

## 2) Quick inspect (always first)

```bash
git --no-pager status --short
git --no-pager branch --show-current
git --no-pager remote -v
```

## 3) Mandatory safe recipes

### A) Push code files only (exclude DB)

```bash
git restore --staged .
git add inventory_app/ui/README.md inventory_app/ui/static/admin_theme.css
git commit -m "UI/CSS updates only (no DB)"
git push origin $(git --no-pager branch --show-current)
git tag -a checkpoint-YYYYMMDD-HHMM-<step> -m "<scope + reason>"
git push origin checkpoint-YYYYMMDD-HHMM-<step>
```

### B) Push code + DB together

```bash
git restore --staged .
git add inventory_app/ui/README.md inventory_app/ui/static/admin_theme.css sql_inventory_master.db
git commit -m "UI/CSS updates and live DB update"
git push origin $(git --no-pager branch --show-current)
git tag -a checkpoint-YYYYMMDD-HHMM-<step> -m "<scope + reason>"
git push origin checkpoint-YYYYMMDD-HHMM-<step>
```

### C) Create snapshot branches (post-push)

```bash
git branch stable-<active-branch>-YYYY-MM-DD
git push origin stable-<active-branch>-YYYY-MM-DD

git branch rollback-YYYY-MM-DD-<active-branch>
git push origin rollback-YYYY-MM-DD-<active-branch>
```

### D) Revert branch naming (avoid incomplete names)

Use full names only, for example:

```bash
git branch revert-YYYY-MM-DD-<active-branch>
git push origin revert-YYYY-MM-DD-<active-branch>
```

## 4) Guardrails

- Do not run `--force-with-lease` unless user explicitly confirms.
- Never push unknown staged files.
- For DB pushes, confirm user accepts binary diff + merge risk.
- If uncertain, stop and re-run section 1 query.
- Non-compliance rule: if gate requirements are not met, do not commit, push, or tag.
- No extra tag-label confirmation is required beyond the section 1 gate.

## 5) Mandatory checkpoint protocol (for congruency + fast rollback)

Use this for every commit event so “current NOW” is always recoverable.

### Required for every commit event
- Rule logic change (validation/governance/concurrency/audit)
- Schema/migration change
- API contract change
- UX workflow change affecting save/edit behavior
- Any fix you may need to quickly revert
- Micro-fix / WIP commit on local branch

### Timing rule
- Commit, push, and tag as one required sequence for each commit event.
- Create a checkpoint tag immediately after push.
- Update daily checklist note with the checkpoint tag.

### Checkpoint recipe (mandatory)

```bash
git --no-pager status --short
git add -A
git commit -m "STEP: <short milestone title>"
git push origin $(git --no-pager branch --show-current)

# Immutable milestone marker (fast return point)
git tag -a checkpoint-YYYYMMDD-HHMM-<step> -m "<scope + reason>"
git push origin checkpoint-YYYYMMDD-HHMM-<step>
```

### Optional extra safety for risky changes

```bash
git branch snapshot-YYYYMMDD-HHMM-<step>
git push origin snapshot-YYYYMMDD-HHMM-<step>
```

### Quick restore options
- Inspect checkpoints:

```bash
git tag --list "checkpoint-*" --sort=-creatordate
```

- Recreate working branch from checkpoint:

```bash
git checkout -b restore-<step> checkpoint-YYYYMMDD-HHMM-<step>
```

- Hard reset current branch to checkpoint (destructive; confirm first):

```bash
git reset --hard checkpoint-YYYYMMDD-HHMM-<step>
git push --force-with-lease
```

### Current NOW marker policy
- Latest pushed commit on active branch + latest `checkpoint-*` tag = official “NOW”.
- Do not proceed to any next step until a checkpoint exists.
