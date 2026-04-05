# PUSH Command System (Reference + Pre-Action Query)

Use this as the standard recall file before any git ACTION/APPLY/push.

## 1) Mandatory Pre-Action Query (ask user first)

Copy/paste this block and get explicit answers before pushing:

- Scope: **Code-only** or **Code + DB**?
- Branch target: confirm push branch (default `main`?)
- Snapshot branches required: `stable-*`, `rollback-*`, `revert-*`?
- Any `--force-with-lease` required? (Default: **No**)
- Commit message text approved? (Y/N)
- Proceed now? (Y/N)

## 2) Quick inspect (always first)

```bash
git --no-pager status --short
git --no-pager branch --show-current
git --no-pager remote -v
```

## 3) Safe recipes

### A) Push code files only (exclude DB)

```bash
git restore --staged .
git add inventory_app/ui/README.md inventory_app/ui/static/admin_theme.css
git commit -m "UI/CSS updates only (no DB)"
git push origin main
```

### B) Push code + DB together

```bash
git restore --staged .
git add inventory_app/ui/README.md inventory_app/ui/static/admin_theme.css sql_inventory_master.db
git commit -m "UI/CSS updates and live DB update"
git push origin main
```

### C) Create snapshot branches (post-push)

```bash
git branch stable-main-YYYY-MM-DD
git push origin stable-main-YYYY-MM-DD

git branch rollback-YYYY-MM-DD-main
git push origin rollback-YYYY-MM-DD-main
```

### D) Revert branch naming (avoid incomplete names)

Use full names only, for example:

```bash
git branch revert-YYYY-MM-DD-main
git push origin revert-YYYY-MM-DD-main
```

## 4) Guardrails

- Do not run `--force-with-lease` unless user explicitly confirms.
- Never push unknown staged files.
- For DB pushes, confirm user accepts binary diff + merge risk.
- If uncertain, stop and re-run section 1 query.
