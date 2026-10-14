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
import {
  createThemeCompatibilityRegistry,
  createThemeSourceMetadata,
  normalizedThemeContents,
} from './update-blog-template.mjs'

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

function writeTemplateFiles(destination, source, sourceRef, sourceCommit, selectedFiles, isOfficialSource) {
  const blogRoot = path.join(destination, 'blog')
  mkdirSync(blogRoot, { recursive: true })

  for (const relativePath of selectedFiles) {
    const sourcePath = path.join(source, relativePath)
    if (!lstatSync(sourcePath).isFile()) {
      throw new Error(`Allowlisted theme path is not a regular file: ${relativePath}`)
    }
    const targetPath = path.join(blogRoot, relativePath)
    mkdirSync(path.dirname(targetPath), { recursive: true })
    writeFileSync(targetPath, normalizedThemeContents(readFileSync(sourcePath), relativePath))
  }

  const packagePath = path.join(blogRoot, 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  packageJson.name = 'public-blog'
  packageJson.private = true
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

  mkdirSync(path.join(destination, '.blog'), { recursive: true })
  writeFileSync(path.join(destination, '.blog', 'config.json'), `${JSON.stringify({
    schemaVersion: 1,
    theme: { id: 'astro-paper', options: { 'astro-paper': {}, 'astro-cactus': {} } },
    site: {
      url: 'https://example.github.io/your-blog/',
      title: 'Your Blog',
      description: 'A blog powered by Astro.',
      author: 'Your Name',
      ogImage: 'default-og.jpg',
      lang: 'en',
      timezone: 'UTC',
      dir: 'ltr',
    },
    home: {
      title: 'Hello World',
      description: 'Welcome to your new blog.',
      readmeUrl: 'https://github.com/example/your-blog',
    },
    posts: { perPage: 10, perIndex: 10, scheduledPostMargin: 900000 },
    features: {
      lightAndDarkMode: true,
      dynamicOgImage: true,
      showArchives: true,
      showBackButton: true,
      editPost: { enabled: false },
      search: 'pagefind',
    },
    socials: [],
    shareLinks: [
      { name: 'whatsapp', url: 'https://wa.me/?text=' },
      { name: 'facebook', url: 'https://www.facebook.com/sharer.php?u=' },
      { name: 'x', url: 'https://x.com/intent/post?url=' },
      { name: 'telegram', url: 'https://t.me/share/url?url=' },
      { name: 'pinterest', url: 'https://pinterest.com/pin/create/button/?url=' },
      { name: 'mail', url: 'mailto:?subject=See%20this%20post&body=' },
    ],
  }, null, 2)}\n`)

  writeFileSync(path.join(blogRoot, 'astro-paper.config.ts'), `import { defineAstroPaperConfig } from "./src/types/config";
import config from "../.blog/config.json";
import { resolveBlogConfiguration } from "../scripts/blog-config.mjs";

const resolved = resolveBlogConfiguration(config);
export const blogDeployment = resolved.deployment;
export const blogHome = resolved.themeConfig.home;
export default defineAstroPaperConfig(resolved.themeConfig);
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
  writeFileSync(path.join(destination, '.gitattributes'), '* text=auto eol=lf\n')
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

配置字段、派生文件和检查方式见 [docs/configuration.md](docs/configuration.md)。

## 维护主题

主题源码更新方式见 [docs/template-updates.md](docs/template-updates.md)。

## 来源与许可证

主题源码来源、锁定版本和文件筛选说明见 [docs/template-origin.md](docs/template-origin.md)。
`)
  writeFileSync(path.join(destination, 'docs', 'template-origin.md'), `# 模板来源与文件筛选

本仓库由维护者的个人博客项目导出，使用显式文件白名单生成；没有复制个人博客的 Git 历史。

## 主题来源

- 官方仓库：${isOfficialSource ? upstreamUrl : git(source, ['remote', 'get-url', 'origin'])}
- 当前主题版本、提交与逐文件摘要：\`.template/theme-source.json\`
- 已验证的兼容版本：\`.template/compatibility.json\`
- 主题许可证：\`blog/LICENSE\`，保留于 AstroPaper 源码目录。
- 模板许可证：根目录 \`LICENSE\`。

只复制运行主题需要的配置、依赖、页面、布局、组件、样式、工具、图标和主题图片。上游仓库的文章、About 页面及其他内容资源不会进入模板；About 会替换为通用占位文字，文章目录保持为空。主题配置与 Astro 部署设置由根目录 \`.blog/config.json\` 派生，用户只需维护这一份配置。

白名单同时记录各文件的上游版本摘要，用于在更新时检测主题源码的本地改动。
兼容版本清单 \`.template/compatibility.json\` 记录维护者验证过的上游标签与完整提交；未列入清单的发行版不会应用。
`)

  writeFileSync(path.join(destination, 'docs', 'configuration.md'), `# 博客配置

根目录 \`.blog/config.json\` 是博客站点设置的唯一可编辑来源，包含站点资料、首页内容、文章分页、功能开关、社交链接和当前主题选项。模板中的示例资料是占位值，创建自己的博客后请替换为真实设置。

\`blog/astro-paper.config.ts\` 以及 Astro 的域名、项目子路径和语言设置由该配置解析生成；不要直接编辑这些衍生文件。AstroPaper 首页的标题、介绍和说明链接也读取此配置。

运行 \`node scripts/validate-blog-config.mjs\` 检查配置。文章放在 \`blog/src/content/posts/\`，About 页面放在 \`blog/src/content/pages/about.md\`。本模板面向公开博客，提交到仓库的文章和设置会公开可见。
`)

  writeFileSync(path.join(destination, 'docs', 'template-updates.md'), `# 主题更新

模板通过 \`.github/workflows/update-theme.yml\` 每月检查 AstroPaper 最新稳定发行版，也支持从仓库的 Actions 页面手动触发。更新器固定官方仓库地址，并且只覆盖来源清单中的文件；不会同步上游文章、About、工作流或其他未列出的文件。新版本通过 Astro 检查后，会以 PR 形式提出源码更新，并将精确标签与提交写入兼容清单。只有审核并合并 PR 后，新版本才成为已接受的基线；没有白名单源码变化时不会产生空 PR。

更新运行会先确认仓库工作区干净，并比对当前主题文件与上次记录的 SHA-256。若用户修改过任何受管理的主题文件，更新会在写入前中止并列出路径；先保存或撤销这些修改，再重新运行。单一配置 \`.blog/config.json\`、衍生配置、About 内容、文章和个人资源不属于主题清单，会保留。

更新通过 Astro 检查后，workflow 使用 GitHub Actions 创建或更新 \`automation/update-astro-paper\` 分支上的 PR，不会自动合并。首次运行前，在 **Settings → Actions → General → Workflow permissions** 开启 **Allow GitHub Actions to create and approve pull requests**。

手动准备最新稳定版候选：

\`\`\`sh
node scripts/update-blog-template.mjs --latest --propose
\`\`\`

手动固定 release 时同时提供 \`--ref <tag>\`、\`--commit <完整提交 SHA>\` 和 \`--propose\`。更新器会把主题变更与精确来源 pin 写入工作区；通过 Astro 检查后，再运行 \`node scripts/update-blog-template.mjs --record-current\` 将提交登记为已验证版本。workflow 会在检查后自动登记候选，验证失败时只保存源码补丁 artifact，不会登记未验证版本。若主题白名单文件没有实际变化，更新器不会改写来源元数据或产生空 PR。
`)

  mkdirSync(path.join(destination, '.template'), { recursive: true })
  const sourceRepository = isOfficialSource ? upstreamUrl : git(source, ['remote', 'get-url', 'origin'])
  const sourceMetadata = createThemeSourceMetadata({
    repository: sourceRepository,
    ref: sourceRef,
    commit: sourceCommit,
    templateRoot: destination,
    files: selectedFiles,
  })
  writeFileSync(path.join(destination, '.template', 'theme-source.json'), `${JSON.stringify(sourceMetadata, null, 2)}\n`)
  const compatibilityRegistry = createThemeCompatibilityRegistry({
    repository: sourceRepository,
    ref: sourceRef,
    commit: sourceCommit,
  })
  writeFileSync(
    path.join(destination, '.template', 'compatibility.json'),
    `${JSON.stringify(compatibilityRegistry, null, 2)}\n`,
  )

  mkdirSync(path.join(destination, 'scripts'), { recursive: true })
  for (const script of ['blog-config.mjs', 'blog-config.d.mts', 'validate-blog-config.mjs']) {
    copyFileSync(
      path.join(repositoryRoot, 'scripts', script),
      path.join(destination, 'scripts', script),
    )
  }
  copyFileSync(
    path.join(repositoryRoot, 'scripts', 'update-blog-template.mjs'),
    path.join(destination, 'scripts', 'update-blog-template.mjs'),
  )
  mkdirSync(path.join(destination, '.github', 'workflows'), { recursive: true })
  copyFileSync(
    path.join(repositoryRoot, 'scripts', 'templates', 'update-theme.yml'),
    path.join(destination, '.github', 'workflows', 'update-theme.yml'),
  )
}

function exportTemplateFromSource({ destination, source, sourceRef, isOfficialSource }) {
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
    writeTemplateFiles(safeDestination, source, sourceRef, sourceCommit, selectedFiles, isOfficialSource)

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

export function exportTemplateFromThemeSource({ sourceRef = 'local override', ...options }) {
  exportTemplateFromSource({ ...options, sourceRef, isOfficialSource: false })
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
    exportTemplateFromSource({ destination, source, sourceRef: upstreamRef, isOfficialSource: true })
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
