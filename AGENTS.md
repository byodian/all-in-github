# Repository Guidelines

## Project Structure & Module Organization

- `actions/`: TypeScript scripts that read GitHub Issues/comments and generate Markdown content.
- `actions/src/config.ts`: repository, timezone, labels, and content path settings.
- `blog/`: AstroPaper-based blog subtree with pages, layouts, components, styles, and content.
- `blog/src/content/blog/`: generated and manually maintained Markdown posts.
- `blog/public/`: static assets served by the blog.
- `.github/workflows/`: note generation, blog publishing, and GitHub Pages deployment.

## Build, Test, and Development Commands

- `npm run install:all`: install dependencies for both `actions/` and `blog/`.
- `npm run build:actions`: compile the GitHub automation TypeScript.
- `npm run build:blog`: run `astro check`, build the site, and generate Pagefind search assets.
- `npm run build:all`: build both project areas.
- `npm run lint:all`: run ESLint for both areas; current scripts may apply fixes.
- `npm run dev:blog`: start the Astro development server.

## Coding Style & Naming Conventions

`actions/` uses TypeScript with single quotes and no semicolons. `blog/` follows ESLint, Prettier, Astro, and Tailwind config; use `pnpm --prefix blog format`. Avoid `console` in blog code because ESLint rejects it.

Keep simple one-off predicates, guards, and sorting expressions inline. Add helpers only when they are reused or hide meaningful domain complexity.

Name Astro components in PascalCase, for example `Header.astro`. Keep utility modules in camelCase, for example `getSortedPosts.ts`. Blog files may include dates and Chinese titles; preserve generated names unless changing the generator.

## Testing Guidelines

There is no separate unit test suite. Treat builds as required verification:

- Run `npm run build:actions` after changing `actions/src`.
- Run `npm run build:blog` after changing Astro pages, components, styles, config, or content.
- Run `npm run lint:all` before submitting broad code changes.

For content-only Markdown edits, verify frontmatter and run the blog build when practical.

## Commit & Pull Request Guidelines

Recent commits use concise messages such as `docs: ...`, `docs(categories: Note, tags: ...): update ...`, and `update makeNote action script`. Prefer imperative, scoped messages: `fix(actions): handle missing issue labels` or `docs: update blog setup notes`.

Pull requests should include a summary, affected area (`actions`, `blog`, workflows, or content), verification commands, and screenshots for visible blog UI changes. Link related issues when changing Issue publishing behavior.

## Security & Configuration Tips

Do not commit personal access tokens or generated secrets. Repository values live in `actions/src/config.ts` and `blog/src/config.ts`; update owner, repo, site URL, and base path together when forking.
