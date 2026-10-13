import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))
const upstreamUrl = 'https://github.com/satnaing/astro-paper.git'
const upstreamRef = 'v6.1.0'
const upstreamCommit = '4c33a60529f9c443145a89fe526ff231c009272d'
const themeFileManifest = JSON.parse(readFileSync(fileURLToPath(new URL('./template-theme-files.json', import.meta.url)), 'utf8'))
if (
  !Array.isArray(themeFileManifest) ||
  themeFileManifest.some(file =>
    typeof file !== 'string' ||
    path.isAbsolute(file) ||
    file.split('/').some(segment => !segment || segment === '.' || segment === '..') ||
    file.includes('\\'),
  ) ||
  new Set(themeFileManifest).size !== themeFileManifest.length
) {
  throw new Error('The theme file manifest must contain unique, repository-relative paths.')
}

function git(directory, args, options = {}) {
  return execFileSync('git', ['-C', directory, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim()
}

function configuredGitIdentity() {
  return {
    GIT_AUTHOR_NAME: git(repositoryRoot, ['config', '--get', 'user.name']),
    GIT_AUTHOR_EMAIL: git(repositoryRoot, ['config', '--get', 'user.email']),
    GIT_COMMITTER_NAME: git(repositoryRoot, ['config', '--get', 'user.name']),
    GIT_COMMITTER_EMAIL: git(repositoryRoot, ['config', '--get', 'user.email']),
  }
}

function parseArguments(args) {
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index]
    if (name !== '--destination') {
      throw new Error(`Unknown option: ${name}`)
    }
    const value = args[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Expected a value after ${name}`)
    }
    if (options[name]) {
      throw new Error(`Option provided more than once: ${name}`)
    }
    options[name] = value
    index += 1
  }

  if (!options['--destination']) {
    throw new Error('Usage: node scripts/export-blog-template.mjs --destination <new-directory>')
  }

  return { destination: validateDestination(options['--destination']) }
}

function validateDestination(value) {
  const destination = path.resolve(value)
  if (existsSync(destination)) {
    throw new Error(`Destination already exists: ${destination}`)
  }

  const canonicalDestination = canonicalizeProspectivePath(destination)
  const relativeDestination = path.relative(repositoryRoot, canonicalDestination)
  if (
    relativeDestination !== '..' &&
    !relativeDestination.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativeDestination)
  ) {
    throw new Error('The destination must be outside the personal source repository.')
  }
  return destination
}

function canonicalizeProspectivePath(target) {
  let existingPath = target
  const remainingParts = []
  while (!existsSync(existingPath)) {
    try {
      lstatSync(existingPath)
      throw new Error(`Destination path contains a dangling symlink: ${existingPath}`)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    const parent = path.dirname(existingPath)
    if (parent === existingPath) throw new Error(`Cannot resolve destination path: ${target}`)
    remainingParts.unshift(path.basename(existingPath))
    existingPath = parent
  }
  return path.resolve(realpathSync(existingPath), ...remainingParts)
}

function getTrackedThemeFiles(source) {
  if (!existsSync(path.join(source, '.git'))) {
    throw new Error(`Theme source is not a Git repository: ${source}`)
  }
  if (git(source, ['status', '--porcelain'])) {
    throw new Error('Theme source must have a clean working tree so uncommitted files cannot enter the template.')
  }

  const sourceCommit = git(source, ['rev-parse', 'HEAD'])
  const trackedFiles = git(source, [
    'ls-files',
    '-z',
    '--',
    ...themeFileManifest.map(file => `:(literal)${file}`),
  ])
    .split('\0')
    .filter(Boolean)
  const expected = new Set(themeFileManifest)
  const selectedFiles = trackedFiles.filter(file => expected.has(file)).sort()
  const missingPaths = themeFileManifest.filter(file => !selectedFiles.includes(file))
  if (missingPaths.length) {
    throw new Error(`Theme source is missing required files: ${missingPaths.join(', ')}`)
  }

  return { selectedFiles, sourceCommit }
}

function writeTemplateFiles(destination, source, sourceCommit, selectedFiles, isOfficialSource) {
  const blogRoot = path.join(destination, 'blog')
  mkdirSync(blogRoot, { recursive: true })

  for (const relativePath of selectedFiles) {
    const sourcePath = path.join(source, relativePath)
    if (!lstatSync(sourcePath).isFile()) {
      throw new Error(`Allowlisted theme path is not a regular file: ${relativePath}`)
    }
    const targetPath = path.join(blogRoot, relativePath)
    mkdirSync(path.dirname(targetPath), { recursive: true })
    copyFileSync(sourcePath, targetPath)
  }

  const packagePath = path.join(blogRoot, 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  packageJson.name = 'public-blog'
  packageJson.private = true
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

  writeFileSync(path.join(blogRoot, 'astro-paper.config.ts'), `import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://example.github.io/your-blog/",
    title: "Your Blog",
    description: "A blog powered by Astro.",
    author: "Your Name",
    ogImage: "default-og.jpg",
    lang: "en",
    timezone: "UTC",
    dir: "ltr",
  },
  posts: {
    perPage: 10,
    perIndex: 10,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: { enabled: false },
    search: "pagefind",
  },
  socials: [],
  shareLinks: [
    { name: "whatsapp", url: "https://wa.me/?text=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "pinterest", url: "https://pinterest.com/pin/create/button/?url=" },
    { name: "mail", url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
`)

  const pagesRoot = path.join(blogRoot, 'src', 'content', 'pages')
  const postsRoot = path.join(blogRoot, 'src', 'content', 'posts')
  mkdirSync(pagesRoot, { recursive: true })
  mkdirSync(postsRoot, { recursive: true })
  writeFileSync(path.join(pagesRoot, 'about.md'), `---
title: "About"
description: "About this blog."
---

Write your introduction here.
`)
  writeFileSync(path.join(postsRoot, '.gitkeep'), '')

  copyFileSync(path.join(repositoryRoot, 'LICENSE'), path.join(destination, 'LICENSE'))
  mkdirSync(path.join(destination, 'docs'), { recursive: true })
  writeFileSync(path.join(destination, '.gitignore'), `node_modules/
dist/
.astro/
.env
.env.*
!.env.example
.DS_Store
**/public/pagefind/
`)
  writeFileSync(path.join(destination, 'README.md'), `# Public Blog Template

这是公开博客模板的基础阶段产物。模板以 [AstroPaper](https://github.com/satnaing/astro-paper) 为首个主题源码，采用全新的 Git 历史；不会复制原个人博客的文章、About、个人图片、Issue、工作流或提交记录。

## 本阶段内容

- 保留主题运行所需的源码、依赖锁文件及许可证。
- 提供不含个人资料的站点配置、About 页面和空文章目录。
- 文章与站点设置均面向公开博客。放入仓库的内容会公开可见。

浏览器配置向导、仓库初始化及发布流程将在后续阶段实现。当前可以本地预览主题；暂不要把此阶段产物当作已完成的免终端配置产品。

## 本地预览

需要 Node.js 22.12 或更新版本，以及 pnpm。

\`\`\`sh
cd blog
pnpm install --frozen-lockfile
pnpm dev
\`\`\`

当前站点设置位于 \`blog/astro-paper.config.ts\`。将设置改为自己的信息后，可在 \`blog/src/content/posts/\` 添加 Markdown 文章。

## 来源与许可证

主题源码来源、锁定版本和文件筛选说明见 [docs/template-origin.md](docs/template-origin.md)。
`)
  writeFileSync(path.join(destination, 'docs', 'template-origin.md'), `# 模板来源与文件筛选

本仓库由维护者的个人博客项目导出，使用显式文件白名单生成；没有复制个人博客的 Git 历史。

## 主题来源

- 官方仓库：${isOfficialSource ? upstreamUrl : '本地验证源（仅用于导出测试）'}
- 标签：${isOfficialSource ? upstreamRef : 'local override'}
- 提交：\`${sourceCommit}\`
- 主题许可证：\`blog/LICENSE\`，保留于 AstroPaper 源码目录。
- 模板许可证：根目录 \`LICENSE\`。

默认导出器会先检出 AstroPaper ${upstreamRef}，并验证提交为 \`${upstreamCommit}\`。只复制运行主题需要的配置、依赖、页面、布局、组件、样式、工具、图标和主题图片。上游仓库的文章、About 页面及其他内容资源不会进入模板；About 会替换为通用占位文字，文章目录保持为空。

如需更新主题基线，应先审查上游版本、白名单和兼容性，再调整导出器中的固定版本与提交。
`)
}

function exportTemplateFromSource({ destination, source, isOfficialSource }) {
  const safeDestination = validateDestination(destination)
  const { selectedFiles, sourceCommit } = getTrackedThemeFiles(source)
  if (isOfficialSource && sourceCommit !== upstreamCommit) {
    throw new Error(`Unexpected ${upstreamRef} commit: ${sourceCommit}`)
  }

  let destinationCreated = false

  try {
    mkdirSync(path.dirname(safeDestination), { recursive: true })
    mkdirSync(safeDestination)
    destinationCreated = true
    writeTemplateFiles(safeDestination, source, sourceCommit, selectedFiles, isOfficialSource)

    execFileSync('git', ['init', '--quiet', safeDestination], { stdio: 'inherit' })
    git(safeDestination, ['symbolic-ref', 'HEAD', 'refs/heads/main'])
    git(safeDestination, ['add', '--all'])
    git(safeDestination, ['commit', '--quiet', '-m', 'Initial public blog template'], {
      env: { ...process.env, ...configuredGitIdentity() },
    })

    process.stdout.write(`Created clean template at ${safeDestination}\n`)
  } catch (error) {
    if (destinationCreated) rmSync(safeDestination, { recursive: true, force: true })
    throw error
  }
}

export function exportTemplateFromThemeSource(options) {
  exportTemplateFromSource({ ...options, isOfficialSource: false })
}

function exportOfficialTemplate({ destination }) {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'public-blog-template-'))
  const source = path.join(temporaryDirectory, 'astro-paper')
  try {
    execFileSync('git', [
      'clone',
      '--quiet',
      '--depth',
      '1',
      '--branch',
      upstreamRef,
      upstreamUrl,
      source,
    ], { stdio: 'inherit' })
    exportTemplateFromSource({ destination, source, isOfficialSource: true })
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    exportOfficialTemplate(parseArguments(process.argv.slice(2)))
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
