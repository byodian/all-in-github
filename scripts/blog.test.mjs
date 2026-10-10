import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { release, tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { detectWsl, verificationSteps } from './blogPlatform.mjs'

const script = fileURLToPath(new URL('./blog.mjs', import.meta.url))
const commitDate = '2026-10-10T10:00:00+00:00'
let commitSequence = 0

function nextCommitDate() {
  // git-subtree itself uses date-ordered history; fixtures model successive operations.
  return new Date(
    Date.parse(commitDate) + commitSequence++ * 1000,
  ).toISOString()
}

function git(cwd, ...args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: commitDate,
      GIT_COMMITTER_DATE: nextCommitDate(),
    },
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout.trim()
}

function write(cwd, path, contents) {
  const file = join(cwd, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, contents)
}

function commit(cwd, message) {
  git(cwd, 'add', '.')
  git(cwd, 'commit', '-m', message)
  return git(cwd, 'rev-parse', 'HEAD')
}

function toolEnvironment(bin, values) {
  const pathKey = Object.keys(process.env).find(
    (key) => key.toUpperCase() === 'PATH',
  )
  return { [pathKey]: `${bin}${delimiter}${process.env[pathKey]}`, ...values }
}

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'blog sync test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const upstream = join(directory, 'theme')
  const root = join(directory, 'main')
  const worktree = join(directory, 'sync (工具)')
  for (const [path, branch] of [
    [upstream, 'dev'],
    [root, 'main'],
  ]) {
    mkdirSync(path)
    git(path, 'init', '-b', branch)
    git(path, 'config', 'user.name', 'BAI YONGJIAN')
    git(path, 'config', 'user.email', 'byj6696@gmail.com')
    git(path, 'config', 'commit.gpgsign', 'false')
    git(path, 'config', 'core.autocrlf', 'false')
  }
  write(upstream, 'src/theme.ts', 'export const theme = "original"\n')
  write(upstream, 'src/content/blog/shared.md', 'original article\n')
  write(upstream, 'src/content/blog/retired.md', 'retired article\n')
  write(upstream, 'src/content/blog/deleted.md', 'deleted article\n')
  const initialSource = commit(upstream, 'initial theme')
  write(
    root,
    'scripts/blog.config.json',
    JSON.stringify({
      repository: upstream,
      sourceBranch: 'dev',
      prefix: 'blog',
      articles: 'blog/src/content/blog',
      localRepository: '../theme',
      baseBranch: 'main',
    }),
  )
  copyFileSync(script, join(root, 'scripts/blog.mjs'))
  copyFileSync(
    fileURLToPath(new URL('./blogPlatform.mjs', import.meta.url)),
    join(root, 'scripts/blogPlatform.mjs'),
  )
  symlinkSync(
    fileURLToPath(new URL('../node_modules', import.meta.url)),
    join(root, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  )
  write(root, '.gitignore', 'node_modules/\n')
  commit(root, 'initial main')
  git(root, 'subtree', 'add', '--prefix=blog', upstream, 'dev', '--squash')
  write(root, 'blog/src/content/blog/shared.md', 'main repository article\n')
  write(root, 'blog/src/content/blog/中文 空格.md', 'main-only article\n')
  const base = commit(root, 'maintain articles in main')
  function run(
    args = [],
    env = {},
    { prepareOnly = true, defaultWorktree = false } = {},
  ) {
    return spawnSync(
      process.execPath,
      [
        join(root, 'scripts/blog.mjs'),
        'sync',
        ...(defaultWorktree ? [] : ['--worktree', worktree]),
        ...(prepareOnly ? ['--prepare-only'] : []),
        ...args,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          GIT_AUTHOR_DATE: commitDate,
          GIT_COMMITTER_DATE: nextCommitDate(),
          GITHUB_OUTPUT: '',
          ...env,
        },
      },
    )
  }
  return { directory, upstream, root, worktree, base, initialSource, run }
}

test('preserves conflicting, deleted, renamed and added articles without touching a dirty main workspace', (t) => {
  const f = fixture(t)
  write(f.upstream, 'src/theme.ts', 'export const theme = "updated"\n')
  write(f.upstream, 'src/content/blog/shared.md', 'upstream article\n')
  git(
    f.upstream,
    'mv',
    'src/content/blog/retired.md',
    'src/content/blog/renamed.md',
  )
  git(f.upstream, 'rm', 'src/content/blog/deleted.md')
  write(f.upstream, 'src/content/blog/example.md', 'upstream example\n')
  const source = commit(f.upstream, 'update theme and articles')
  write(f.root, 'blog/src/content/blog/shared.md', 'uncommitted main article\n')
  write(f.root, 'untracked.txt', 'keep this file\n')
  const status = git(f.root, 'status', '--porcelain')
  const result = f.run()
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.equal(
    readFileSync(join(f.worktree, 'blog/src/theme.ts'), 'utf8'),
    'export const theme = "updated"\n',
  )
  assert.equal(
    git(
      f.worktree,
      'diff',
      '--exit-code',
      f.base,
      'HEAD',
      '--',
      'blog/src/content/blog',
    ),
    '',
  )
  assert.equal(
    existsSync(join(f.worktree, 'blog/src/content/blog/example.md')),
    false,
  )
  assert.equal(
    existsSync(join(f.worktree, 'blog/src/content/blog/renamed.md')),
    false,
  )
  assert.equal(git(f.root, 'status', '--porcelain'), status)
  assert.equal(
    readFileSync(join(f.root, 'blog/src/content/blog/shared.md'), 'utf8'),
    'uncommitted main article\n',
  )
  assert.equal(git(f.root, 'rev-parse', 'HEAD'), f.base)
  assert.match(
    git(f.worktree, 'log', '--format=%B'),
    new RegExp(`git-subtree-split: ${source}`),
  )
})

test('restores cleanly merged article changes and supports the next synchronization after merge', (t) => {
  const f = fixture(t)
  write(
    f.upstream,
    'src/content/blog/retired.md',
    'silently updated upstream article\n',
  )
  write(f.upstream, 'src/content/blog/example.md', 'sample\n')
  write(f.upstream, 'src/theme.ts', 'first theme update\n')
  const first = commit(f.upstream, 'cleanly merged changes')
  let result = f.run()
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.equal(
    git(
      f.worktree,
      'diff',
      '--exit-code',
      f.base,
      'HEAD',
      '--',
      'blog/src/content/blog',
    ),
    '',
  )
  assert.match(git(f.worktree, 'log', '-1', '--format=%s'), /preserve articles/)
  const branch = git(f.worktree, 'branch', '--show-current')
  git(f.root, 'merge', '--no-ff', branch, '-m', 'merge synchronization')
  git(f.root, 'worktree', 'remove', f.worktree)
  result = f.run()
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.match(result.stdout, /无需创建分支/)
  assert.equal(existsSync(f.worktree), false)
  write(f.upstream, 'src/theme.ts', 'second theme update\n')
  const second = commit(f.upstream, 'next theme change')
  result = f.run()
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.match(result.stdout, new RegExp(`已同步主题：${first}`))
  assert.match(result.stdout, new RegExp(`本次主题：${second}`))
  assert.equal(
    git(
      f.worktree,
      'diff',
      '--exit-code',
      'main',
      'HEAD',
      '--',
      'blog/src/content/blog',
    ),
    '',
  )
})

test('retains source conflicts for manual resolution and preserves articles first', (t) => {
  const f = fixture(t)
  write(f.root, 'blog/src/theme.ts', 'local source change\n')
  const base = commit(f.root, 'local source change')
  write(f.upstream, 'src/theme.ts', 'upstream source change\n')
  write(f.upstream, 'src/content/blog/shared.md', 'upstream article change\n')
  commit(f.upstream, 'conflicting update')
  const result = f.run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /源码冲突需要手动处理/)
  assert.equal(
    git(f.worktree, 'diff', '--name-only', '--diff-filter=U'),
    'blog/src/theme.ts',
  )
  assert.equal(
    git(
      f.worktree,
      'diff',
      '--cached',
      '--exit-code',
      base,
      '--',
      'blog/src/content/blog',
    ),
    '',
  )
  assert.equal(git(f.root, 'rev-parse', 'HEAD'), base)
  assert.equal(git(f.root, 'status', '--porcelain'), '')
})

test('an unchanged upstream produces machine-readable no-op output without creating a worktree', (t) => {
  const f = fixture(t)
  const output = join(f.directory, 'output')
  const result = f.run([], { GITHUB_OUTPUT: output })
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.equal(existsSync(f.worktree), false)
  assert.match(readFileSync(output, 'utf8'), /changed=false/)
  assert.match(result.stdout, new RegExp(f.initialSource))
})

test('reads the newest subtree record when squash commit timestamps are equal', (t) => {
  const f = fixture(t)
  const timestamp = git(
    f.root,
    'log',
    '-1',
    '--format=%ct',
    '--grep=^git-subtree-dir: blog$',
  )
  write(f.upstream, 'src/theme.ts', 'updated theme\n')
  const source = commit(f.upstream, 'update theme')
  let result = f.run([], { GIT_COMMITTER_DATE: timestamp })
  assert.equal(result.status, 0, result.stderr + result.stdout)
  git(
    f.root,
    'merge',
    '--no-ff',
    git(f.worktree, 'branch', '--show-current'),
    '-m',
    'merge synchronization',
  )
  git(f.root, 'worktree', 'remove', f.worktree)
  result = f.run()
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.match(result.stdout, new RegExp(`已同步主题：${source}`))
  assert.match(result.stdout, /无需创建分支/)
  assert.equal(existsSync(f.worktree), false)
})

test('an explicit newer baseline retains newly committed main articles and emits exact commit outputs', (t) => {
  const f = fixture(t)
  write(f.root, 'blog/src/content/blog/new.md', 'new main article\n')
  const base = commit(f.root, 'new main article')
  git(f.root, 'branch', 'new-baseline', base)
  write(f.upstream, 'src/theme.ts', 'new theme\n')
  const source = commit(f.upstream, 'new theme')
  const output = join(f.directory, 'output')
  const result = f.run(['--base-ref', 'new-baseline'], {
    GITHUB_OUTPUT: output,
  })
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.equal(
    git(
      f.worktree,
      'diff',
      '--exit-code',
      base,
      'HEAD',
      '--',
      'blog/src/content/blog',
    ),
    '',
  )
  const values = readFileSync(output, 'utf8')
  assert.match(values, /changed=true/)
  assert.match(values, new RegExp(`base=${base}`))
  assert.match(values, new RegExp(`source=${source}`))
  assert.ok(values.includes(`worktree=${f.worktree}`))
  const report = values.match(/^report=(.+)$/m)[1]
  assert.match(readFileSync(report, 'utf8'), /尚未执行/)
})

test(
  'WSL rejects a prohibited fetch argument before running Git',
  { skip: process.platform !== 'linux' },
  (t) => {
    const f = fixture(t)
    const path = join(f.root, 'scripts/blog.config.json')
    const config = JSON.parse(readFileSync(path, 'utf8'))
    config.sourceBranch = 'build-prohibited'
    writeFileSync(path, JSON.stringify(config))
    const result = f.run([], { WSL_DISTRO_NAME: 'test' })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /WSL 禁止/)
    assert.doesNotMatch(result.stdout, /> git fetch/)
    assert.equal(existsSync(f.worktree), false)
  },
)

test('the default worktree under the Git common directory supports subtree merges', (t) => {
  const f = fixture(t)
  write(f.upstream, 'src/theme.ts', 'updated theme\n')
  commit(f.upstream, 'update theme')
  const output = join(f.directory, 'output')
  const result = f.run([], { GITHUB_OUTPUT: output }, { defaultWorktree: true })
  assert.equal(result.status, 0, result.stderr + result.stdout)
  const path = readFileSync(output, 'utf8').match(/^worktree=(.+)$/m)[1]
  assert.ok(path.startsWith(join(f.root, '.git', 'blog-sync')))
  assert.equal(
    git(
      path,
      'diff',
      '--exit-code',
      f.base,
      'HEAD',
      '--',
      'blog/src/content/blog',
    ),
    '',
  )
  assert.equal(git(f.root, 'status', '--porcelain'), '')
})

test('verification failure leaves the prepared commit available for repair without reporting success', (t) => {
  const f = fixture(t)
  write(f.upstream, 'src/theme.ts', 'updated theme\n')
  commit(f.upstream, 'update theme')
  const bin = join(f.directory, 'bin')
  mkdirSync(bin)
  writeFileSync(
    join(bin, process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'),
    process.platform === 'win32'
      ? '@echo off\r\nexit /b 17\r\n'
      : '#!/bin/sh\nexit 17\n',
    { mode: 0o755 },
  )
  const output = join(f.directory, 'output')
  const result = f.run([], toolEnvironment(bin, { GITHUB_OUTPUT: output }), {
    prepareOnly: false,
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /已保留工作目录/)
  assert.match(result.stderr, /blog:verify/)
  assert.equal(
    git(
      f.worktree,
      'diff',
      '--exit-code',
      f.base,
      'HEAD',
      '--',
      'blog/src/content/blog',
    ),
    '',
  )
  assert.equal(
    readFileSync(join(f.worktree, 'blog/src/theme.ts'), 'utf8'),
    'updated theme\n',
  )
  assert.equal(git(f.root, 'rev-parse', 'HEAD'), f.base)
  assert.equal(existsSync(output), false)
})

test('WSL detection applies only to Linux and recognizes both environment and kernel signals', () => {
  assert.equal(detectWsl('linux', { WSL_DISTRO_NAME: 'Ubuntu' }, '6.6.0'), true)
  assert.equal(detectWsl('linux', {}, '6.6.114-microsoft-standard-WSL2'), true)
  assert.equal(detectWsl('linux', {}, '6.6.0-generic'), false)
  assert.equal(
    detectWsl('darwin', { WSL_DISTRO_NAME: 'Ubuntu' }, 'Darwin'),
    false,
  )
  assert.equal(
    detectWsl('win32', { WSL_DISTRO_NAME: 'Ubuntu' }, 'Windows'),
    false,
  )
})

test('WSL verification disables lifecycle scripts and contains no prohibited command', () => {
  const steps = verificationSteps(true)
  assert.ok(
    steps.find((args) => args[0] === 'install').includes('--ignore-scripts'),
  )
  assert.doesNotMatch(steps.flat().join(' '), /build/i)
})

test('native verification includes site generation and search indexing', () => {
  const steps = verificationSteps(false)
  assert.ok(
    !steps.find((args) => args[0] === 'install').includes('--ignore-scripts'),
  )
  assert.ok(
    steps.some((args) => args.includes('astro') && args.includes('build')),
  )
  assert.ok(
    steps.some((args) => args.includes('pagefind') && args.includes('dist')),
  )
})

test(
  'native verification handles command shims and copies search assets in paths with spaces',
  { skip: detectWsl(process.platform, process.env, release()) },
  (t) => {
    const f = fixture(t)
    write(f.upstream, 'src/theme.ts', 'updated theme\n')
    commit(f.upstream, 'update theme')
    const bin = join(f.directory, 'tool shims')
    mkdirSync(bin)
    const runner = join(bin, 'pnpm.cjs')
    const log = join(f.directory, 'commands.jsonl')
    writeFileSync(
      runner,
      `const fs = require('node:fs')
const path = require('node:path')
const args = process.argv.slice(2)
fs.appendFileSync(process.env.BLOG_TEST_LOG, JSON.stringify(args) + '\\n')
if (args.includes('pagefind')) {
  const assets = path.join(args[1], 'dist/pagefind')
  fs.mkdirSync(assets, { recursive: true })
  fs.writeFileSync(path.join(assets, 'index.js'), 'search index')
}
`,
    )
    writeFileSync(
      join(bin, process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'),
      process.platform === 'win32'
        ? '@echo off\r\n"%BLOG_TEST_NODE%" "%BLOG_TEST_RUNNER%" %*\r\n'
        : '#!/bin/sh\nexec "$BLOG_TEST_NODE" "$BLOG_TEST_RUNNER" "$@"\n',
      { mode: 0o755 },
    )
    const result = f.run(
      [],
      toolEnvironment(bin, {
        BLOG_TEST_NODE: process.execPath,
        BLOG_TEST_RUNNER: runner,
        BLOG_TEST_LOG: log,
      }),
      { prepareOnly: false },
    )
    assert.equal(result.status, 0, result.stderr + result.stdout)
    assert.equal(
      readFileSync(join(f.worktree, 'blog/public/pagefind/index.js'), 'utf8'),
      'search index',
    )
    const calls = readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    assert.ok(calls.every((args) => args[1] === join(f.worktree, 'blog')))
    assert.match(result.stdout, /完整构建和 Pagefind 索引生成均通过/)
  },
)
