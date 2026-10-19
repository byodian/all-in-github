import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./sync-upstream.mjs", import.meta.url));
const identity = spawnSync("git", ["config", "user.name"], {
  encoding: "utf8",
}).stdout.trim();
const email = spawnSync("git", ["config", "user.email"], {
  encoding: "utf8",
}).stdout.trim();

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function write(root, path, contents) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), contents);
}

function commit(root, message) {
  git(root, "add", ".");
  git(root, "commit", "-m", message);
  return git(root, "rev-parse", "HEAD");
}

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "upstream-sync-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const upstream = join(directory, "upstream");
  const root = join(directory, "fork");
  mkdirSync(upstream);
  git(upstream, "init", "-b", "main");
  git(upstream, "config", "user.name", identity);
  git(upstream, "config", "user.email", email);
  git(upstream, "config", "commit.gpgsign", "false");
  write(upstream, "src/theme.ts", "original theme\n");
  write(upstream, "src/content/blog/shared.md", "original article\n");
  write(upstream, "src/content/blog/deleted.md", "article retained by fork\n");
  write(upstream, "astro-paper.config.ts", "original site\n");
  commit(upstream, "initial upstream");
  git(directory, "clone", upstream, root);
  git(root, "switch", "-c", "dev");
  git(root, "config", "user.name", identity);
  git(root, "config", "user.email", email);
  git(root, "config", "commit.gpgsign", "false");
  write(root, "src/content/blog/shared.md", "personal article\n");
  write(root, "src/content/blog/中文 空格.md", "personal-only article\n");
  write(root, "astro-paper.config.ts", "personal site\n");
  write(
    root,
    "scripts/upstream.config.json",
    JSON.stringify({
      repository: upstream,
      sourceRef: "refs/heads/main",
      baseBranch: "dev",
      protectedPaths: [
        "src/content/blog",
        "src/data/posts",
        "astro-paper.config.ts",
      ],
    })
  );
  copyFileSync(script, join(root, "scripts/sync-upstream.mjs"));
  const base = commit(root, "customize fork");
  function run(args = []) {
    const output = join(directory, "output.txt");
    writeFileSync(output, "");
    const result = spawnSync(
      process.execPath,
      [join(root, "scripts/sync-upstream.mjs"), ...args],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, GITHUB_OUTPUT: output },
      }
    );
    return {
      ...result,
      values: Object.fromEntries(
        readFileSync(output, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map(line => {
            const separator = line.indexOf("=");
            return [line.slice(0, separator), line.slice(separator + 1)];
          })
      ),
    };
  }
  return { upstream, root, base, run };
}

test("already-integrated ancestry is a no-op despite personal fork commits", t => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.values.changed, "false");
  assert.equal(result.values.worktree, undefined);
  assert.equal(git(f.root, "rev-parse", "HEAD"), f.base);
});

test("merges latest source and preserves protected modifications, additions, deletions and renames", t => {
  const f = fixture(t);
  write(f.upstream, "src/theme.ts", "latest theme\n");
  write(f.upstream, "src/content/blog/shared.md", "upstream changed article\n");
  write(f.upstream, "src/content/blog/example.md", "new upstream sample\n");
  git(
    f.upstream,
    "mv",
    "src/content/blog/deleted.md",
    "src/content/blog/renamed.md"
  );
  write(f.upstream, "src/data/posts/example.md", "new sample directory\n");
  write(f.upstream, "astro-paper.config.ts", "new upstream site\n");
  const source = commit(f.upstream, "update source and personal paths");
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const worktree = result.values.worktree;
  assert.equal(
    readFileSync(join(worktree, "src/theme.ts"), "utf8"),
    "latest theme\n"
  );
  git(
    worktree,
    "diff",
    "--exit-code",
    f.base,
    "HEAD",
    "--",
    "src/content/blog",
    "src/data/posts",
    "astro-paper.config.ts"
  );
  git(worktree, "merge-base", "--is-ancestor", source, "HEAD");
  assert.equal(
    git(worktree, "rev-list", "--parents", "-n", "1", "HEAD").split(" ").length,
    3
  );
  assert.equal(existsSync(join(worktree, "src/data/posts/example.md")), false);
  assert.equal(git(f.root, "rev-parse", "HEAD"), f.base);
  assert.equal(git(worktree, "status", "--porcelain"), "");
});

test("source changes only in protected paths still record ancestry and do not repeat", t => {
  const f = fixture(t);
  write(f.upstream, "src/content/blog/deleted.md", "cleanly merged edit\n");
  commit(f.upstream, "edit upstream article");
  const first = f.run();
  assert.equal(first.status, 0, first.stderr);
  const second = f.run(["--base-ref", first.values.branch]);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.values.changed, "false");
});

test("consecutive merges use the last integrated source as their ancestor", t => {
  const f = fixture(t);
  write(f.upstream, "src/theme.ts", "first update\n");
  commit(f.upstream, "first update");
  const first = f.run();
  assert.equal(first.status, 0, first.stderr);
  write(f.upstream, "src/theme.ts", "second update\n");
  const secondSource = commit(f.upstream, "second update");
  const second = f.run(["--base-ref", first.values.branch]);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(
    readFileSync(join(second.values.worktree, "src/theme.ts"), "utf8"),
    "second update\n"
  );
  git(
    second.values.worktree,
    "merge-base",
    "--is-ancestor",
    secondSource,
    "HEAD"
  );
});

test("source conflicts stop the merge, retain its worktree and leave the original checkout untouched", t => {
  const f = fixture(t);
  write(f.root, "src/theme.ts", "fork source change\n");
  const base = commit(f.root, "change fork source");
  write(f.root, "astro-paper.config.ts", "uncommitted site\n");
  write(f.root, "personal.txt", "untracked note\n");
  const status = git(f.root, "status", "--porcelain");
  write(f.upstream, "src/theme.ts", "upstream source change\n");
  write(f.upstream, "src/content/blog/shared.md", "conflicting article\n");
  commit(f.upstream, "conflicting source");
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /源码冲突/);
  assert.equal(git(f.root, "rev-parse", "HEAD"), base);
  assert.equal(git(f.root, "status", "--porcelain"), status);
  assert.equal(
    git(result.values.worktree, "diff", "--name-only", "--diff-filter=U"),
    "src/theme.ts"
  );
  git(result.values.worktree, "rev-parse", "--verify", "MERGE_HEAD");
  git(
    result.values.worktree,
    "diff",
    "--cached",
    "--exit-code",
    base,
    "--",
    "src/content/blog"
  );
});

test("a repeated attempt refuses to overwrite an existing sync branch", t => {
  const f = fixture(t);
  write(f.upstream, "src/theme.ts", "updated theme\n");
  commit(f.upstream, "update");
  const first = f.run();
  assert.equal(first.status, 0, first.stderr);
  const head = git(first.values.worktree, "rev-parse", "HEAD");
  const second = f.run();
  assert.equal(second.status, 1);
  assert.equal(git(first.values.worktree, "rev-parse", "HEAD"), head);
});

test("publishing refuses to replace dev when it advanced during validation", t => {
  const f = fixture(t);
  const remote = join(f.root, "..", "origin.git");
  git(f.root, "clone", "--bare", f.root, remote);
  git(f.root, "remote", "add", "publish", remote);
  write(f.upstream, "src/theme.ts", "upstream update\n");
  commit(f.upstream, "update upstream");
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  write(f.root, "personal.txt", "concurrent work\n");
  const advanced = commit(f.root, "advance dev during validation");
  git(f.root, "push", "publish", "HEAD:refs/heads/dev");
  const publish = spawnSync("git", ["push", "publish", "HEAD:refs/heads/dev"], {
    cwd: result.values.worktree,
    encoding: "utf8",
  });
  assert.notEqual(publish.status, 0);
  assert.equal(git(remote, "rev-parse", "dev"), advanced);
});

test("a failure bundle retains the fetched source even before a merge commit exists", t => {
  const f = fixture(t);
  write(f.root, "src/theme.ts", "fork change\n");
  commit(f.root, "fork source change");
  write(f.upstream, "src/theme.ts", "upstream change\n");
  const source = commit(f.upstream, "upstream source change");
  const result = f.run();
  assert.equal(result.status, 1);
  const bundle = join(f.root, "..", "recovery.bundle");
  git(f.root, "bundle", "create", bundle, "--all", result.values.source);
  const recovered = join(f.root, "..", "recovered");
  git(f.root, "clone", bundle, recovered);
  git(recovered, "cat-file", "-e", `${source}^{commit}`);
});
