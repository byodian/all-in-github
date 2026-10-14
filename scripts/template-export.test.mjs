import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { exportTemplateFromThemeSource } from './export-blog-template.mjs'
import { recordCurrentThemeRelease, updateTemplateFromThemeSource } from './update-blog-template.mjs'

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

function registerVerifiedThemeRelease(destination, ref, commit) {
  const registryPath = path.join(destination, '.template/compatibility.json')
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  registry.verifiedReleases.push({ ref, commit })
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
  git(destination, ['add', '.template/compatibility.json'])
  git(destination, ['commit', '--quiet', '-m', `approve theme release ${ref}`])
}

function makeThemeSource(parent) {
  const source = path.join(parent, 'theme-source')
  mkdirSync(source)
  for (const relativePath of themeFiles) {
    const contents = relativePath === 'package.json'
      ? '{"name":"astro-paper"}\n'
      : relativePath === 'LICENSE'
        ? 'Theme license\n'
        : relativePath === 'astro.config.ts'
          ? `import config from "./astro-paper.config";

export default defineConfig({
  site: config.site.url,
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
});
`
          : relativePath === 'src/pages/index.astro'
            ? `import config from "@/config";

<h1 class="hero-title">
  Mingalaba
</h1>
<p>
  AstroPaper is a minimal, responsive, accessible and SEO-friendly Astro
  blog theme. This theme follows best practices and provides accessibility
  out of the box. Light and dark mode are supported by default. Moreover,
  additional color schemes can also be configured.
</p>
<LinkButton href="https://github.com/satnaing/astro-paper#readme">README</LinkButton>
`
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
  exportTemplateFromThemeSource({ destination, source, sourceRef: 'v1.0.0' })
  const files = git(destination, ['ls-files']).split('\n').sort()
  assert.deepEqual(files, [
    '.gitattributes',
    '.github/workflows/update-theme.yml',
    '.gitignore',
    '.blog/config.json',
    '.template/theme-source.json',
    '.template/compatibility.json',
    'LICENSE',
    'README.md',
    'blog/astro-paper.config.ts',
    'blog/src/content/pages/about.md',
    'blog/src/content/posts/.gitkeep',
    'docs/configuration.md',
    'docs/template-origin.md',
    'docs/template-updates.md',
    'scripts/blog-config.d.mts',
    'scripts/blog-config.mjs',
    'scripts/update-blog-template.mjs',
    'scripts/validate-blog-config.mjs',
    ...themeFiles.map(file => `blog/${file}`),
  ].sort())

  const config = readFileSync(path.join(destination, 'blog/astro-paper.config.ts'), 'utf8')
  const canonicalConfig = JSON.parse(readFileSync(path.join(destination, '.blog/config.json'), 'utf8'))
  const astroConfig = readFileSync(path.join(destination, 'blog/astro.config.ts'), 'utf8')
  const about = readFileSync(path.join(destination, 'blog/src/content/pages/about.md'), 'utf8')
  const homePage = readFileSync(path.join(destination, 'blog/src/pages/index.astro'), 'utf8')
  const readme = readFileSync(path.join(destination, 'README.md'), 'utf8')
  const configurationGuide = readFileSync(path.join(destination, 'docs/configuration.md'), 'utf8')
  const packageJson = JSON.parse(readFileSync(path.join(destination, 'blog/package.json'), 'utf8'))
  const sourceMetadata = JSON.parse(readFileSync(path.join(destination, '.template/theme-source.json'), 'utf8'))
  const compatibilityRegistry = JSON.parse(readFileSync(path.join(destination, '.template/compatibility.json'), 'utf8'))
  const workflow = readFileSync(path.join(destination, '.github/workflows/update-theme.yml'), 'utf8')
  const exportedText = files
    .filter(file => /\.(md|mdx|ts|mjs|json|yml|yaml|css|astro)$/.test(file))
    .map(file => readFileSync(path.join(destination, file), 'utf8'))
    .join('\n')

  assert.match(config, /\.blog\/config\.json/)
  assert.match(homePage, /import \{ blogHome \} from "\.\.\/\.\.\/astro-paper\.config"/)
  assert.match(homePage, /\{blogHome\.title\}/)
  assert.match(homePage, /\{blogHome\.description\}/)
  assert.match(homePage, /href=\{blogHome\.readmeUrl\}/)
  assert.doesNotMatch(homePage, /Mingalaba/)
  assert.match(readme, /docs\/configuration\.md/)
  assert.doesNotMatch(readme, /唯一可编辑来源/)
  assert.match(configurationGuide, /唯一可编辑来源/)
  assert.equal(canonicalConfig.schemaVersion, 1)
  assert.equal(canonicalConfig.theme.id, 'astro-paper')
  assert.equal(canonicalConfig.site.title, 'Your Blog')
  assert.equal(canonicalConfig.site.author, 'Your Name')
  assert.match(astroConfig, /blogDeployment\.site/)
  assert.match(astroConfig, /blogDeployment\.base/)
  assert.match(astroConfig, /blogDeployment\.locales/)
  assert.match(astroConfig, /blogDeployment\.defaultLocale/)
  assert.match(about, /Write your introduction here/)
  assert.equal(packageJson.name, 'public-blog')
  assert.equal(sourceMetadata.commit, sourceCommit)
  assert.deepEqual(compatibilityRegistry.verifiedReleases, [{ ref: 'v1.0.0', commit: sourceCommit }])
  assert.equal(Object.keys(sourceMetadata.files).length, themeFiles.length)
  assert.match(workflow, /schedule:/)
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /create-pull-request/)
  assert.match(workflow, /actions\/upload-artifact@v4/)
  assert.match(workflow, /capture-patch/)
  assert.match(workflow, /git diff --binary -- blog \.template\/theme-source\.json/)
  assert.doesNotMatch(workflow, /git diff --binary[^\n]*compatibility\.json/)
  assert.match(workflow, /does not mark this source as verified/)
  assert.match(workflow, /astro-paper-unverified-candidate/)
  assert.match(workflow, /--latest --propose/)
  assert.match(workflow, /--record-current/)
  assert.ok(workflow.indexOf('astro check') < workflow.indexOf('--record-current'))
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

test('exports one validated settings source that resolves theme and deployment settings', async t => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'blog-template-config-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))

  const source = makeThemeSource(temp)
  const destination = path.join(temp, 'template')
  exportTemplateFromThemeSource({ destination, source, sourceRef: 'v1.0.0' })

  const configPath = path.join(destination, '.blog/config.json')
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  config.site.url = 'https://example.org/my-blog/'
  config.site.title = 'Reader Blog'
  config.site.lang = 'zh-CN'
  config.theme.options['astro-cactus'] = { colorScheme: 'warm' }
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)

  const { resolveBlogConfiguration } = await import(pathToFileURL(path.join(destination, 'scripts/blog-config.mjs')))
  const resolved = resolveBlogConfiguration(config)
  assert.equal(resolved.themeId, 'astro-paper')
  assert.deepEqual(resolved.themeOptions, config.theme.options)
  assert.equal(resolved.themeConfig.site.url, 'https://example.org/my-blog/')
  assert.equal(resolved.themeConfig.site.base, '/my-blog')
  assert.deepEqual(resolved.themeConfig.home, config.home)
  assert.deepEqual(resolved.deployment, {
    site: 'https://example.org',
    base: '/my-blog',
    locales: ['zh-CN'],
    defaultLocale: 'zh-CN',
  })

  const validatorPath = path.join(destination, 'scripts/validate-blog-config.mjs')
  const validResult = spawnSync(process.execPath, [validatorPath], { cwd: destination, encoding: 'utf8' })
  assert.equal(validResult.status, 0, validResult.stderr)

  config.theme.id = 'unsupported-theme'
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
  const invalidResult = spawnSync(process.execPath, [validatorPath], { cwd: destination, encoding: 'utf8' })
  assert.notEqual(invalidResult.status, 0)
  assert.match(invalidResult.stderr, /theme\.id/)
})

test('updates a generated template from a newer source while preserving user files and history', t => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'blog-template-update-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))

  const source = makeThemeSource(temp)
  const destination = path.join(temp, 'template')
  exportTemplateFromThemeSource({ destination, source, sourceRef: 'v1.0.0' })
  const rootCommit = git(destination, ['rev-list', '--max-parents=0', 'HEAD'])
  const siteConfig = path.join(destination, '.blog/config.json')
  const article = path.join(destination, 'blog/src/content/posts/my-post.md')
  const canonicalConfig = JSON.parse(readFileSync(siteConfig, 'utf8'))
  canonicalConfig.site.title = 'Template User'
  writeFileSync(siteConfig, `${JSON.stringify(canonicalConfig, null, 2)}\n`)
  writeSourceFile(destination, 'blog/src/content/posts/my-post.md', 'A public user article\n')
  git(destination, ['add', '--all'])
  git(destination, ['commit', '--quiet', '-m', 'personalize template'])

  const updatedThemeFile = 'src/pages/index.astro'
  const windowsCheckedOutFile = path.join(destination, 'blog', updatedThemeFile)
  git(destination, ['config', 'core.safecrlf', 'false'])
  writeFileSync(windowsCheckedOutFile, readFileSync(windowsCheckedOutFile, 'utf8').replace(/\n/g, '\r\n'))
  git(destination, ['add', '--all'])
  assert.equal(git(destination, ['status', '--porcelain']), '')

  const updatedIndex = readFileSync(path.join(source, updatedThemeFile), 'utf8').replace(
    '<LinkButton',
    '<aside>New upstream section</aside>\n<LinkButton',
  )
  writeSourceFile(source, updatedThemeFile, updatedIndex)
  git(source, ['add', '--all'])
  git(source, ['commit', '--quiet', '-m', 'release v1.1.0'])
  const sourceCommit = git(source, ['rev-parse', 'HEAD'])
  registerVerifiedThemeRelease(destination, 'v1.1.0', sourceCommit)

  assert.equal(
    updateTemplateFromThemeSource({ destination, source, sourceRef: 'v1.1.0' }),
    true,
  )
  const synchronizedIndex = readFileSync(path.join(destination, 'blog', updatedThemeFile), 'utf8')
  assert.match(synchronizedIndex, /New upstream section/)
  assert.match(synchronizedIndex, /\{blogHome\.title\}/)
  assert.match(synchronizedIndex, /\{blogHome\.description\}/)
  assert.match(synchronizedIndex, /href=\{blogHome\.readmeUrl\}/)
  assert.equal(JSON.parse(readFileSync(siteConfig, 'utf8')).site.title, 'Template User')
  assert.match(readFileSync(path.join(destination, 'blog/astro-paper.config.ts'), 'utf8'), /resolveBlogConfiguration/)
  assert.equal(readFileSync(article, 'utf8'), 'A public user article\n')
  assert.equal(readFileSync(path.join(source, 'package.json'), 'utf8'), '{"name":"astro-paper"}\n')
  assert.equal(git(source, ['status', '--porcelain']), '')
  assert.equal(git(destination, ['rev-list', '--max-parents=0', 'HEAD']), rootCommit)
  assert.equal(JSON.parse(readFileSync(path.join(destination, '.template/theme-source.json'), 'utf8')).commit, sourceCommit)
  assert.notEqual(git(destination, ['status', '--porcelain']), '')
})

test('skips source versions outside the compatibility registry', t => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'blog-template-compatibility-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))

  const source = makeThemeSource(temp)
  const destination = path.join(temp, 'template')
  exportTemplateFromThemeSource({ destination, source, sourceRef: 'v1.0.0' })
  const themeFile = themeFiles.find(file => file.endsWith('.astro'))
  writeSourceFile(source, themeFile, 'Unreviewed upstream theme component\n')
  git(source, ['add', '--all'])
  git(source, ['commit', '--quiet', '-m', 'unreviewed release'])

  const before = git(destination, ['status', '--porcelain'])
  assert.equal(updateTemplateFromThemeSource({ destination, source, sourceRef: 'v1.1.0' }), false)
  assert.equal(git(destination, ['status', '--porcelain']), before)
  assert.equal(readFileSync(path.join(destination, 'blog', themeFile), 'utf8'), `Theme source file: ${themeFile}\n`)
})

test('records a proposed release only after its validation step', t => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'blog-template-release-proposal-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))

  const source = makeThemeSource(temp)
  const destination = path.join(temp, 'template')
  exportTemplateFromThemeSource({ destination, source, sourceRef: 'v1.0.0' })
  const themeFile = themeFiles.find(file => file.endsWith('.astro'))
  writeSourceFile(source, themeFile, 'Compatible candidate theme component\n')
  git(source, ['add', '--all'])
  git(source, ['commit', '--quiet', '-m', 'candidate release'])
  const sourceCommit = git(source, ['rev-parse', 'HEAD'])

  assert.equal(
    updateTemplateFromThemeSource({ destination, source, sourceRef: 'v1.1.0', proposeRelease: true }),
    true,
  )
  const registryPath = path.join(destination, '.template/compatibility.json')
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  assert.deepEqual(registry.verifiedReleases, [{ ref: 'v1.0.0', commit: git(source, ['rev-parse', 'HEAD~1']) }])
  assert.equal(JSON.parse(readFileSync(path.join(destination, '.template/theme-source.json'), 'utf8')).commit, sourceCommit)
  assert.equal(readFileSync(path.join(destination, 'blog', themeFile), 'utf8'), 'Compatible candidate theme component\n')

  assert.equal(recordCurrentThemeRelease(destination), true)
  const verifiedRegistry = JSON.parse(readFileSync(registryPath, 'utf8'))
  assert.deepEqual(verifiedRegistry.verifiedReleases.at(-1), { ref: 'v1.1.0', commit: sourceCommit })
})

test('does not verify a candidate if a managed theme file changed after preparation', t => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'blog-template-unverified-candidate-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))

  const source = makeThemeSource(temp)
  const destination = path.join(temp, 'template')
  exportTemplateFromThemeSource({ destination, source, sourceRef: 'v1.0.0' })
  const themeFile = themeFiles.find(file => file.endsWith('.astro'))
  writeSourceFile(source, themeFile, 'Candidate theme component\n')
  git(source, ['add', '--all'])
  git(source, ['commit', '--quiet', '-m', 'candidate release'])
  updateTemplateFromThemeSource({ destination, source, sourceRef: 'v1.1.0', proposeRelease: true })
  writeFileSync(path.join(destination, 'blog', themeFile), 'Edited after validation\n')
  const registryBefore = readFileSync(path.join(destination, '.template/compatibility.json'), 'utf8')

  assert.throws(() => recordCurrentThemeRelease(destination), /cannot be verified/)
  assert.equal(readFileSync(path.join(destination, '.template/compatibility.json'), 'utf8'), registryBefore)
})

test('does not create a registry entry when a candidate release has no allowlisted file changes', t => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'blog-template-no-theme-diff-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))

  const source = makeThemeSource(temp)
  const destination = path.join(temp, 'template')
  exportTemplateFromThemeSource({ destination, source, sourceRef: 'v1.0.0' })
  git(source, ['commit', '--allow-empty', '--quiet', '-m', 'release without theme changes'])
  const oldMetadata = readFileSync(path.join(destination, '.template/theme-source.json'), 'utf8')
  const oldRegistry = readFileSync(path.join(destination, '.template/compatibility.json'), 'utf8')

  assert.equal(updateTemplateFromThemeSource({ destination, source, sourceRef: 'v1.1.0', proposeRelease: true }), false)
  assert.equal(readFileSync(path.join(destination, '.template/theme-source.json'), 'utf8'), oldMetadata)
  assert.equal(readFileSync(path.join(destination, '.template/compatibility.json'), 'utf8'), oldRegistry)
  assert.equal(git(destination, ['status', '--porcelain']), '')
})

test('stops before changing the template when a managed theme file has local edits', t => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'blog-template-conflict-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))

  const source = makeThemeSource(temp)
  const destination = path.join(temp, 'template')
  exportTemplateFromThemeSource({ destination, source, sourceRef: 'v1.0.0' })

  const themeFile = themeFiles.find(file => file.endsWith('.astro'))
  const templateFile = path.join(destination, 'blog', themeFile)
  writeFileSync(templateFile, 'local theme customization\n')
  git(destination, ['add', '--all'])
  git(destination, ['commit', '--quiet', '-m', 'customize theme'])

  writeSourceFile(source, themeFile, 'Updated upstream theme component\n')
  git(source, ['add', '--all'])
  git(source, ['commit', '--quiet', '-m', 'release v1.1.0'])
  registerVerifiedThemeRelease(destination, 'v1.1.0', git(source, ['rev-parse', 'HEAD']))
  const previousMetadata = readFileSync(path.join(destination, '.template/theme-source.json'), 'utf8')

  assert.throws(
    () => updateTemplateFromThemeSource({ destination, source, sourceRef: 'v1.1.0' }),
    /need manual conflict resolution/,
  )
  assert.equal(readFileSync(templateFile, 'utf8'), 'local theme customization\n')
  assert.equal(readFileSync(path.join(destination, '.template/theme-source.json'), 'utf8'), previousMetadata)
})

test('does not follow a user-added symlink outside the template during an update', t => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'blog-template-symlink-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))

  const source = makeThemeSource(temp)
  const destination = path.join(temp, 'template')
  const outside = path.join(temp, 'outside')
  exportTemplateFromThemeSource({ destination, source, sourceRef: 'v1.0.0' })
  mkdirSync(outside)
  const outsideFile = path.join(outside, 'Breadcrumb.astro')
  writeFileSync(outsideFile, 'outside data\n')
  rmSync(path.join(destination, 'blog/src/components'), { recursive: true })
  try {
    symlinkSync(outside, path.join(destination, 'blog/src/components'), process.platform === 'win32' ? 'junction' : 'dir')
  } catch {
    t.skip('directory symlinks are unavailable in this environment')
    return
  }
  git(destination, ['add', '--all'])
  git(destination, ['commit', '--quiet', '-m', 'add local symlink'])

  const themeFile = themeFiles.find(file => file === 'src/components/Breadcrumb.astro')
  writeSourceFile(source, themeFile, 'Updated upstream theme component\n')
  git(source, ['add', '--all'])
  git(source, ['commit', '--quiet', '-m', 'release v1.1.0'])
  registerVerifiedThemeRelease(destination, 'v1.1.0', git(source, ['rev-parse', 'HEAD']))

  assert.throws(
    () => updateTemplateFromThemeSource({ destination, source, sourceRef: 'v1.1.0' }),
    /need manual conflict resolution/,
  )
  assert.equal(readFileSync(outsideFile, 'utf8'), 'outside data\n')
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
