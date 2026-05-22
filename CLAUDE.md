# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm run install:all        # install both actions/ and blog/

# Development
npm run dev:blog           # start Astro dev server (blog/)
npm run note:editor        # build actions and start the local Note Editor UI at http://127.0.0.1:4329

# Build
npm run build:actions      # compile actions/ TypeScript to actions/dist/
npm run build:blog         # astro check + build + pagefind (blog/)
npm run build:all          # both of the above

# Lint
npm run lint:all           # ESLint for both areas
pnpm --prefix blog format  # Prettier for blog/
```

There is no automated test suite. Builds serve as verification: run `build:actions` after changing `actions/src`, and `build:blog` after changing blog code or content.

## Architecture

The repo has two independent areas connected by GitHub Actions:

### `actions/` — GitHub automation (TypeScript, Node.js)

TypeScript scripts compiled to `actions/dist/` and run by CI:

- **`makeNote.ts`** — triggered by `issue_comment` events on Issues with the `Note` label. Reads the comment body, extracts `<!-- title: ... -->`, `<!-- tags: ... -->`, `<!-- description: ... -->` HTML comments as metadata (stripped from the post body), and writes/updates a Markdown file at `blog/src/content/blog/{datetime}_{commentId}.md` via the GitHub API.
- **`makeBlog.ts`** — triggered when an Issue with the `Blog` label is given the `Publishing` label. Uses the Issue title as the blog post title, Issue body + comments as content, and writes `blog/src/content/blog/{issueTitle}.md`. After writing, updates Issue labels to `Blog` + `Published`.
- **`noteEditor.ts`** — a local HTTP server (port 4329) with a browser UI for creating/editing Note comments without leaving the terminal. Requires `gh` CLI authenticated as `OWNER`.
- **`config.ts`** — single source of truth for `OWNER`, `REPO`, timezone, file paths, and excluded label lists.

### `blog/` — Astro static site (git subtree)

The `blog/` directory is a git subtree tracking `git@github.com:byodian/astro-paper.git` (dev branch). It is an AstroPaper theme customized for GitHub Pages deployment.

- Blog content lives in `blog/src/content/blog/` — Markdown files with YAML frontmatter (`slug`, `title`, `tags`, `categories`, `pubDatetime`, `modDatetime`).
- Site-wide config: `blog/src/config.ts` (SITE object) and `blog/src/constants.ts` (social links).
- Astro components in `blog/src/components/`, layouts in `blog/src/layouts/`, pages in `blog/src/pages/`.
- The build output goes to `blog/dist/` and is deployed to the `gh-pages` branch.

### GitHub Actions workflows (`.github/workflows/`)

| Workflow | Trigger | What it does |
|---|---|---|
| `build-note.yml` | `issue_comment` created/edited (Issue has `Note` label, commenter is repo owner) | Runs `makeNote.js` to write/update a Markdown file, then pushes to `main`, which triggers `deploy.yml` |
| `build-blog.yml` | Issue labeled (Issue has both `Blog` and `Publishing` labels) | Runs `makeBlog.js` to write a Markdown file and update Issue labels |
| `deploy.yml` | Push to `main` or manual dispatch | Builds the Astro blog and deploys `blog/dist/` to `gh-pages` |

Required repository secret: `ACTIONS_DEPLOY_KEY` — a GitHub fine-grained PAT with Contents, Issues, and Workflows read/write.

## Coding style

- `actions/` TypeScript: single quotes, no semicolons (enforced by `@byodian/eslint-config-ts`).
- `blog/` follows ESLint + Prettier + Astro + Tailwind conventions. No `console` statements in blog code (ESLint will reject them).
- Astro components: PascalCase (`Header.astro`). Utility modules: camelCase (`getSortedPosts.ts`). Generated blog filenames include dates and may contain Chinese characters — preserve naming patterns.

## Forking / customization

When forking, update these two files together:
- `actions/src/config.ts` — `OWNER`, `REPO`
- `blog/src/config.ts` — `website`, `base`, `author`, `profile`, `editPost.url`

## Updating the blog subtree

```bash
git subtree pull --prefix=blog git@github.com:byodian/astro-paper.git dev --squash
```
