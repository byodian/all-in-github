import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { exportTemplateFromThemeSource } from './export-blog-template.mjs'

const scriptPath = fileURLToPath(new URL('./export-blog-template.mjs', import.meta.url))
const repositoryRoot = path.resolve(path.dirname(scriptPath), '..')
const themeFiles = JSON.parse(readFileSync(new URL('./template-theme-files.json', import.meta.url), 'utf8'))

function git(directory, args, env = process.env) {
  return execFileSync('git', ['-C', directory, ...args], { env, encoding: 'utf8' }).trim()
}

function writeSourceFile(source, relativePath, contents) {
  const target = path.join(source, relativePath)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, contents)
}

function makeThemeSource(parent) {
  const source = path.join(parent, 'theme-source')
  mkdirSync(source)
  for (const relativePath of themeFiles) {
    const contents = relativePath === 'package.json'
      ? '{"name":"astro-paper"}\n'
      : relativePath === 'LICENSE'
        ? 'Theme license\n'
        : `Theme source file: ${relativePath}\n`
    writeSourceFile(source, relativePath, contents)
  }

  writeSourceFile(source, 'src/components/Private Example.astro', 'Private Example Person\n')
  writeSourceFile(source, 'src/pages/private-example.astro', 'Private Example Person\n')
  writeSourceFile(source, 'src/styles/private-example.css', 'Private Example Person\n')
  writeSourceFile(source, 'src/utils/private-example.ts', 'Private Example Person\n')
  writeSourceFile(source, 'src/content/posts/private-example.md', 'Private Example Person\n')
  writeSourceFile(source, 'src/content/pages/about.md', 'Private Example Person\n')
  writeSourceFile(source, 'src/assets/images/forrest-gump-quote.png', 'personal image')
  writeSourceFile(source, 'src/secrets.json', '{"token":"do-not-export"}\n')
  writeSourceFile(source, '.github/workflows/private.yml', 'private workflow\n')

  git(source, ['init', '--quiet', '--initial-branch=main'])
  git(source, ['config', 'user.name', 'Theme Source'])
  git(source, ['config', 'user.email', 'theme@example.com'])
  git(source, ['add', '--all'])
  git(source, ['commit', '--quiet', '-m', 'theme source'])
  git(source, ['remote', 'add', 'origin', 'https://example.com/theme.git'])

  return source
}

test('exports an allowlisted template with neutral defaults and one fresh root commit', t => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'blog-template-export-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))

  const source = makeThemeSource(temp)
  const sourceCommit = git(source, ['rev-parse', 'HEAD'])
  const destination = path.join(temp, 'template')
  exportTemplateFromThemeSource({ destination, source })
  const files = git(destination, ['ls-files']).split('\n').sort()
  assert.deepEqual(files, [
    '.gitignore',
    'LICENSE',
    'README.md',
    'blog/astro-paper.config.ts',
    'blog/src/content/pages/about.md',
    'blog/src/content/posts/.gitkeep',
    'docs/template-origin.md',
    ...themeFiles.map(file => `blog/${file}`),
  ].sort())

  const config = readFileSync(path.join(destination, 'blog/astro-paper.config.ts'), 'utf8')
  const about = readFileSync(path.join(destination, 'blog/src/content/pages/about.md'), 'utf8')
  const packageJson = JSON.parse(readFileSync(path.join(destination, 'blog/package.json'), 'utf8'))
  const exportedText = files
    .filter(file => /\.(md|mdx|ts|json|yml|yaml|css|astro)$/.test(file))
    .map(file => readFileSync(path.join(destination, file), 'utf8'))
    .join('\n')

  assert.match(config, /Your Blog/)
  assert.match(config, /Your Name/)
  assert.match(about, /Write your introduction here/)
  assert.equal(packageJson.name, 'public-blog')
  assert.doesNotMatch(exportedText, /Private Example Person|do-not-export|all-in-github|byodian\.github\.io/)
  assert.equal(
    readFileSync(path.join(destination, 'LICENSE'), 'utf8'),
    readFileSync(path.join(repositoryRoot, 'LICENSE'), 'utf8'),
  )
  assert.equal(readFileSync(path.join(destination, 'blog/LICENSE'), 'utf8'), 'Theme license\n')
  assert.equal(git(destination, ['check-ignore', '-q', 'blog/public/pagefind/index.js']), '')

  const commits = git(destination, ['rev-list', '--parents', 'HEAD']).split('\n')
  assert.equal(commits.length, 1)
  assert.match(commits[0], /^[0-9a-f]{40}$/)
  assert.notEqual(commits[0], sourceCommit)
})

test('refuses to overwrite an existing destination', t => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'blog-template-export-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))

  const source = makeThemeSource(temp)
  const destination = path.join(temp, 'template')
  mkdirSync(destination)
  writeFileSync(path.join(destination, 'keep.txt'), 'keep')

  assert.throws(() => exportTemplateFromThemeSource({ destination, source }), /Destination already exists/)
  assert.equal(readFileSync(path.join(destination, 'keep.txt'), 'utf8'), 'keep')
})

test('does not expose an unpinned theme-source override through the CLI', t => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'blog-template-export-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))

  const destination = path.join(temp, 'template')
  const result = spawnSync(process.execPath, [scriptPath, '--destination', destination, '--theme-source', temp], {
    encoding: 'utf8',
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Unknown option: --theme-source/)
  assert.equal(existsSync(destination), false)
})

test('refuses destination names beginning with two dots inside the source repository', t => {
  const destination = path.join(repositoryRoot, '..template-export-test')
  assert.throws(() => exportTemplateFromThemeSource({ destination }), /outside the personal source repository/)
  assert.equal(existsSync(destination), false)
})

test('refuses destinations that resolve into the source repository through a symlink', t => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'blog-template-export-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))

  const link = path.join(temp, 'source-link')
  try {
    symlinkSync(repositoryRoot, link, process.platform === 'win32' ? 'junction' : 'dir')
  } catch {
    t.skip('directory symlinks are unavailable in this environment')
    return
  }

  assert.throws(
    () => exportTemplateFromThemeSource({ destination: path.join(link, 'new-template') }),
    /outside the personal source repository/,
  )
})

test('refuses a dangling symlink ancestor before it can resolve into the source repository', t => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'blog-template-export-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))

  const link = path.join(temp, 'dangling-source-link')
  try {
    symlinkSync(path.join(repositoryRoot, 'not-created-yet'), link, process.platform === 'win32' ? 'junction' : 'dir')
  } catch {
    t.skip('directory symlinks are unavailable in this environment')
    return
  }

  assert.throws(
    () => exportTemplateFromThemeSource({ destination: path.join(link, 'new-template') }),
    /dangling symlink/,
  )
})
