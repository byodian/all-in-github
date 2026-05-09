---
name: publish-note-blog
description: Publish Markdown as a blog post through the all-in-github Note issue workflow. Use when the user wants Codex to create or update a GitHub issue comment that contains hidden HTML metadata comments for title, description, and tags, so the repository's build-note GitHub Action generates an Astro blog post from a Note-labeled issue comment. Offer either the deterministic TUI/script flow or the local Note Editor web tool.
---

# Publish Note Blog

## Overview

Publish posts by creating or editing comments on GitHub issues labeled `Note`. The repository workflow runs only when the comment author is the repository owner, so prefer the locally authenticated `gh` account.

This skill supports the Note-comment flow only. Do not use it for the separate `Blog` + `Publishing` issue flow.

## Publishing Interfaces

At the start of a publishing task, provide two choices unless the user already requested one:

- **TUI**: Codex collects the fields in chat or from files, then uses `scripts/publish_note.py` to create or update the issue comment. Use this for deterministic automation, scripted publishing, stdin/file input, dry runs, and workflow watching.
- **Local Note Editor**: start the repository's local web editor with `scripts/open_note_editor.sh`, which checks `gh auth status` before starting the service; the user edits metadata, Markdown, preview/raw output, and creates or updates Note comments in the browser. Use this when the user wants an interactive local editor, wants to browse existing Note comments, or wants manual control before publishing.

If the user asks to publish immediately and does not choose an interface, prefer TUI for non-interactive execution. If the user asks to open, edit, browse, or use the local editor, start the Local Note Editor.

## Workflow

### TUI

1. Collect the post fields: title, description, tags, body, and the intended category labels.
2. Use a Note issue as the category container. If the user provides an issue number, use it. Otherwise find an open issue with `Note` plus all requested category labels; if none exists, create one with `--issue-title`.
3. Format the comment with hidden metadata before the Markdown body:

   ```md
   <!-- title:  Windows 常用软件  -->
   <!-- tags:  Windows, 开发工具  -->
   <!-- description:  Windows 常用工具集合  -->

   ## 正文
   ```

4. Post a new comment or update an existing comment ID. Creating or editing the comment triggers `build-note`.
5. If requested, watch the latest `build-note.yml` run.

### Local Note Editor

1. Confirm the current workspace is the `all-in-github` repository or move there before starting the server.
2. Start the editor through the skill launcher. The launcher checks `gh auth status` before starting the local service:

   ```bash
   ~/.codex/skills/publish-note-blog/scripts/open_note_editor.sh
   ```

   If `gh` is not authorized, stop and ask the user to run:

   ```bash
   gh auth login --scopes repo,workflow
   ```

   Then rerun the launcher.

3. If the default port is busy, use another one:

   ```bash
   NOTE_EDITOR_PORT=4330 ~/.codex/skills/publish-note-blog/scripts/open_note_editor.sh
   ```

   If running outside the repository root, pass the repo path or set `NOTE_EDITOR_REPO_DIR`:

   ```bash
   ~/.codex/skills/publish-note-blog/scripts/open_note_editor.sh /path/to/all-in-github
   NOTE_EDITOR_REPO_DIR=/path/to/all-in-github ~/.codex/skills/publish-note-blog/scripts/open_note_editor.sh
   ```

4. Give the user the local URL printed by the command, usually `http://127.0.0.1:4329`.
5. Keep the server running while the user edits. Do not also publish the same post through the TUI script unless the user explicitly asks.
6. The editor can:

   - select open `Note` issues;
   - load owner-authored comments;
   - create new Note comments;
   - update existing Note comments;
   - generate the exact hidden metadata comment format through its preview API.

## TUI Script

Use `scripts/publish_note.py` for deterministic publishing:

```bash
python3 ~/.codex/skills/publish-note-blog/scripts/publish_note.py \
  --repo byodian/all-in-github \
  --issue 27 \
  --title "Windows 常用软件" \
  --description "Windows 常用工具集合" \
  --tags "Windows,开发工具" \
  --body-file ./post.md
```

Useful options:

- `--category-label LABEL`: add one or more category labels to the issue; repeat for multiple labels.
- `--issue-title TITLE`: create a Note issue with this title when no matching issue is found.
- `--comment-id ID`: update an existing comment instead of creating a new one.
- `--body-file -`: read the Markdown body from stdin.
- `--dry-run`: print the exact comment body without changing GitHub.
- `--watch`: wait for the newest `build-note.yml` workflow run.

## Guardrails

- Confirm `gh auth status` uses the repository owner before publishing; otherwise the workflow condition will skip the run.
- For the Local Note Editor, use `scripts/open_note_editor.sh` so missing `gh` authorization is detected before the server starts.
- Do not include the metadata HTML comments in the visible body; the action strips them before writing Markdown.
- Keep tags comma-separated in the metadata comment. Category labels come from the issue labels, not from the `tags` metadata.
- Do not publish secrets or private tokens in the Markdown body.
