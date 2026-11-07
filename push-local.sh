#!/usr/bin/env bash
set -euo pipefail

branch=$(git branch --show-current)
[[ -n "$branch" ]] || { echo "Detached HEAD; checkout a branch first." >&2; exit 1; }
git remote get-url origin >/dev/null

git add -A
if ! git diff --cached --quiet; then
  git commit -m "${1:-chore: sync local changes}"
fi
git push origin "$branch"
