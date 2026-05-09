#!/usr/bin/env bash
set -euo pipefail

port="${NOTE_EDITOR_PORT:-4329}"
repo_dir="${NOTE_EDITOR_REPO_DIR:-${1:-}}"

if ! command -v gh >/dev/null 2>&1; then
  cat >&2 <<'EOF'
GitHub CLI is required for the local Note Editor.

Install gh, then authorize GitHub before starting the editor:
  gh auth login --scopes repo,workflow
EOF
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  cat >&2 <<'EOF'
GitHub CLI is not authenticated.

Authorize GitHub before starting the local Note Editor:
  gh auth login --scopes repo,workflow

After authorization, start the editor again.
EOF
  exit 1
fi

if [ -z "$repo_dir" ]; then
  if git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
    repo_dir="$git_root"
  else
    repo_dir="$(pwd)"
  fi
fi

if [ ! -f "$repo_dir/package.json" ] || ! grep -q '"note:editor"' "$repo_dir/package.json"; then
  cat >&2 <<EOF
Run this from the all-in-github repository root, pass the repository path, or set NOTE_EDITOR_REPO_DIR.

Examples:
  ~/.codex/skills/publish-note-blog/scripts/open_note_editor.sh /path/to/all-in-github
  NOTE_EDITOR_REPO_DIR=/path/to/all-in-github ~/.codex/skills/publish-note-blog/scripts/open_note_editor.sh

Resolved repository directory:
  $repo_dir
EOF
  exit 1
fi

cd "$repo_dir"
echo "GitHub auth is ready."
echo "Starting local Note Editor at http://127.0.0.1:$port"
NOTE_EDITOR_PORT="$port" npm run note:editor
