---
name: publish-note-blog
description: Publish Markdown as a blog post through the all-in-github Note issue workflow. Use when the user wants Codex to create or update a GitHub issue comment that contains hidden HTML metadata comments for title, description, and tags, so the repository's build-note GitHub Action generates an Astro blog post from a Note-labeled issue comment.
---

# Publish Note Blog

## Overview

Publish posts by creating or editing comments on GitHub issues labeled `Note`. The repository workflow runs only when the comment author is the repository owner, so prefer the locally authenticated `gh` account.

This skill supports the Note-comment flow only. Do not use it for the separate `Blog` + `Publishing` issue flow.

## Workflow

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

## Script

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
- Do not include the metadata HTML comments in the visible body; the action strips them before writing Markdown.
- Keep tags comma-separated in the metadata comment. Category labels come from the issue labels, not from the `tags` metadata.
- Do not publish secrets or private tokens in the Markdown body.
