import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const astroPaperRepository = 'https://github.com/satnaing/astro-paper.git'
const metadataPath = '.template/theme-source.json'
const compatibilityPath = '.template/compatibility.json'

function git(directory, args, options = {}) {
  return execFileSync('git', ['-C', directory, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim()
}

function sha256(filePath) {
  const contents = readFileSync(filePath)
  return sha256Contents(contents)
}

function sha256Contents(contents) {
  const canonical = contents.includes(0) ? contents : Buffer.from(contents.toString('utf8').replace(/\r\n/g, '\n'))
  return createHash('sha256').update(canonical).digest('hex')
}

export function createThemeSourceMetadata({ repository, ref, commit, templateRoot, files }) {
  return {
    formatVersion: 1,
    theme: 'astro-paper',
    repository,
    ref,
    commit,
    files: Object.fromEntries(files.map(file => [file, sha256(path.join(templateRoot, 'blog', file))])),
  }
}

export function createThemeCompatibilityRegistry({ repository, ref, commit }) {
  return {
    formatVersion: 1,
    theme: 'astro-paper',
    repository,
    verifiedReleases: [{ ref, commit }],
  }
}

function isSafeRelativePath(value) {
  return typeof value === 'string' &&
    !path.isAbsolute(value) &&
    !value.includes('\\') &&
    value.split('/').every(part => part && part !== '.' && part !== '..' && !part.includes(':'))
}

function isRegularFileWithoutSymlinkParents(root, relativePath) {
  const segments = relativePath.split('/')
  let current = root
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment)
    let info
    try {
      info = lstatSync(current)
    } catch (error) {
      if (error.code === 'ENOENT') return false
      throw error
    }
    const isFile = index === segments.length - 1
    if (isFile ? !info.isFile() : !info.isDirectory()) return false
  }
  return true
}

function readThemeMetadata(destination) {
  const filePath = path.join(destination, metadataPath)
  if (!isRegularFileWithoutSymlinkParents(destination, metadataPath)) {
    throw new Error(`Template source metadata is missing: ${metadataPath}`)
  }

  const metadata = JSON.parse(readFileSync(filePath, 'utf8'))
  if (
    metadata.formatVersion !== 1 ||
    metadata.theme !== 'astro-paper' ||
    typeof metadata.repository !== 'string' ||
    !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(metadata.ref) ||
    !/^[0-9a-f]{40}$/.test(metadata.commit) ||
    !metadata.files ||
    Array.isArray(metadata.files) ||
    typeof metadata.files !== 'object' ||
    Object.keys(metadata.files).length === 0 ||
    Object.keys(metadata.files).some(file => !isSafeRelativePath(file) || !/^[0-9a-f]{64}$/.test(metadata.files[file]))
  ) {
    throw new Error(`Template source metadata is invalid: ${metadataPath}`)
  }
  return metadata
}

function readCompatibilityRegistry(destination, repository) {
  if (!isRegularFileWithoutSymlinkParents(destination, compatibilityPath)) {
    throw new Error(`Theme compatibility registry is missing: ${compatibilityPath}`)
  }
  const registry = JSON.parse(readFileSync(path.join(destination, compatibilityPath), 'utf8'))
  if (
    registry.formatVersion !== 1 ||
    registry.theme !== 'astro-paper' ||
    registry.repository !== repository ||
    !Array.isArray(registry.verifiedReleases) ||
    registry.verifiedReleases.length === 0 ||
    registry.verifiedReleases.some(release =>
      !release ||
      !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(release.ref) ||
      !/^[0-9a-f]{40}$/.test(release.commit),
    ) ||
    new Set(registry.verifiedReleases.map(release => release.ref)).size !== registry.verifiedReleases.length
  ) {
    throw new Error(`Theme compatibility registry is invalid: ${compatibilityPath}`)
  }
  return registry
}

function validateTemplateRepository(destination) {
  if (!existsSync(path.join(destination, '.git'))) {
    throw new Error(`Template destination is not a Git repository: ${destination}`)
  }
  const repositoryRoot = realpathSync(destination)
  const gitRoot = realpathSync(git(repositoryRoot, ['rev-parse', '--show-toplevel']))
  if (repositoryRoot !== gitRoot) {
    throw new Error(`Template destination must be the repository root: ${repositoryRoot}`)
  }
  return repositoryRoot
}

export function recordCurrentThemeRelease(destination) {
  const templateRoot = validateTemplateRepository(destination)
  const metadata = readThemeMetadata(templateRoot)
  const registry = readCompatibilityRegistry(templateRoot, metadata.repository)
  const changedThemeFiles = Object.entries(metadata.files)
    .filter(([file, expectedHash]) => {
      const target = path.join(templateRoot, 'blog', file)
      return !isRegularFileWithoutSymlinkParents(templateRoot, `blog/${file}`) || sha256(target) !== expectedHash
    })
    .map(([file]) => file)
  if (changedThemeFiles.length) {
    throw new Error(`Theme files do not match the source pin and cannot be verified:\n${changedThemeFiles.join('\n')}`)
  }
  const releaseForRef = registry.verifiedReleases.find(release => release.ref === metadata.ref)
  if (releaseForRef) {
    if (releaseForRef.commit !== metadata.commit) {
      throw new Error(`Release tag ${metadata.ref} is already pinned to another commit in ${compatibilityPath}.`)
    }
    process.stdout.write(`Theme release ${metadata.ref} (${metadata.commit}) is already verified.\n`)
    return false
  }

  const updatedRegistry = {
    ...registry,
    verifiedReleases: [...registry.verifiedReleases, { ref: metadata.ref, commit: metadata.commit }],
  }
  writeFileSync(path.join(templateRoot, compatibilityPath), `${JSON.stringify(updatedRegistry, null, 2)}\n`)
  process.stdout.write(`Recorded verified AstroPaper release ${metadata.ref} (${metadata.commit}).\n`)
  return true
}

function replaceExactlyOnce(contents, pattern, replacement, file, description) {
  const globalPattern = new RegExp(pattern.source, `${pattern.flags}g`)
  const matches = [...contents.matchAll(globalPattern)]
  if (matches.length !== 1) {
    throw new Error(`Cannot apply the AstroPaper configuration adapter to ${file}: expected one ${description} anchor.`)
  }
  return contents.replace(pattern, replacement)
}

function normalizeAstroConfiguration(contents) {
  let normalized = contents.toString('utf8')
  normalized = replaceExactlyOnce(
    normalized,
    /import config from (["'])\.\/astro-paper\.config\1;/,
    'import config, { blogDeployment } from "./astro-paper.config";',
    'astro.config.ts',
    'configuration import',
  )
  normalized = replaceExactlyOnce(
    normalized,
    /^[ \t]*site: config\.site\.url,[ \t]*\r?$/m,
    '  site: blogDeployment.site,\n  base: blogDeployment.base,',
    'astro.config.ts',
    'site setting',
  )
  return replaceExactlyOnce(
    normalized,
    /^[ \t]*locales: \["en"\],[ \t]*\r?\n[ \t]*defaultLocale: "en",[ \t]*\r?$/m,
    '    locales: blogDeployment.locales,\n    defaultLocale: blogDeployment.defaultLocale,',
    'astro.config.ts',
    'default locale setting',
  )
}

function normalizeHomePage(contents) {
  let normalized = contents.toString('utf8')
  normalized = replaceExactlyOnce(
    normalized,
    /import config from "@\/config";/,
    'import config from "@/config";\nimport { blogHome } from "../../astro-paper.config";',
    'src/pages/index.astro',
    'home configuration import',
  )
  normalized = replaceExactlyOnce(
    normalized,
    /Mingalaba/,
    '{blogHome.title}',
    'src/pages/index.astro',
    'home title',
  )
  normalized = replaceExactlyOnce(
    normalized,
    /AstroPaper is a minimal,[\s\S]*?configured\./,
    '{blogHome.description}',
    'src/pages/index.astro',
    'home description',
  )
  return replaceExactlyOnce(
    normalized,
    /href="https:\/\/github\.com\/satnaing\/astro-paper#readme"/,
    'href={blogHome.readmeUrl}',
    'src/pages/index.astro',
    'home information link',
  )
}

export function normalizedThemeContents(contents, file) {
  if (file === 'package.json') {
    const packageJson = JSON.parse(contents.toString('utf8'))
    packageJson.name = 'public-blog'
    packageJson.private = true
    return Buffer.from(`${JSON.stringify(packageJson, null, 2)}\n`)
  }
  if (file === 'astro.config.ts') return Buffer.from(normalizeAstroConfiguration(contents))
  if (file === 'src/pages/index.astro') return Buffer.from(normalizeHomePage(contents))
  return contents
}

export function updateTemplateFromThemeSource({ destination, source, sourceRef, proposeRelease = false }) {
  const templateRoot = validateTemplateRepository(destination)
  const metadata = readThemeMetadata(templateRoot)
  if (git(source, ['status', '--porcelain'])) {
    throw new Error('Theme source must have a clean working tree.')
  }
  const sourceRepository = git(source, ['remote', 'get-url', 'origin'])
  if (sourceRepository !== metadata.repository) {
    throw new Error(`Unexpected theme source repository: ${sourceRepository}`)
  }

  const sourceCommit = git(source, ['rev-parse', 'HEAD'])
  const registry = readCompatibilityRegistry(templateRoot, metadata.repository)
  const releaseForRef = registry.verifiedReleases.find(release => release.ref === sourceRef)
  if (releaseForRef && releaseForRef.commit !== sourceCommit) {
    throw new Error(`Release tag ${sourceRef} is already pinned to another commit in ${compatibilityPath}.`)
  }
  const releaseIsVerified = Boolean(releaseForRef)
  if (!releaseIsVerified && !proposeRelease) {
    process.stdout.write(`Skipped ${sourceRef} (${sourceCommit}): this release is not in ${compatibilityPath}.\n`)
    return false
  }
  if (sourceCommit === metadata.commit && sourceRef === metadata.ref) {
    process.stdout.write(`Theme is already current at ${sourceRef} (${sourceCommit}).\n`)
    return false
  }

  if (git(templateRoot, ['status', '--porcelain'])) {
    throw new Error('Template working tree must be clean before a theme update.')
  }

  const locallyChangedFiles = Object.entries(metadata.files)
    .filter(([file, expectedHash]) => {
      const target = path.join(templateRoot, 'blog', file)
      return !isRegularFileWithoutSymlinkParents(templateRoot, `blog/${file}`) || sha256(target) !== expectedHash
    })
    .map(([file]) => file)
  if (locallyChangedFiles.length) {
    throw new Error(`Theme files differ from the recorded source and need manual conflict resolution:\n${locallyChangedFiles.join('\n')}`)
  }

  const knownFiles = Object.keys(metadata.files)
  const trackedFiles = git(source, [
    'ls-files',
    '-z',
    '--',
    ...knownFiles.map(file => `:(literal)${file}`),
  ])
    .split('\0')
    .filter(Boolean)
    .sort()
  const selectedFiles = trackedFiles.filter(file => knownFiles.includes(file))
  const removedFiles = knownFiles.filter(file => !selectedFiles.includes(file))

  for (const file of selectedFiles) {
    if (!lstatSync(path.join(source, file)).isFile()) {
      throw new Error(`Allowlisted theme path is not a regular file: ${file}`)
    }
  }
  if (selectedFiles.includes('package.json')) {
    normalizedThemeContents(readFileSync(path.join(source, 'package.json')), 'package.json')
  }

  const normalizedFiles = new Map(
    selectedFiles.map(file => [file, normalizedThemeContents(readFileSync(path.join(source, file)), file)]),
  )
  const unchanged = removedFiles.length === 0 &&
    selectedFiles.length === knownFiles.length &&
    selectedFiles.every(file => sha256Contents(normalizedFiles.get(file)) === metadata.files[file])
  if (unchanged) {
    process.stdout.write(`No allowlisted theme files changed in ${sourceRef} (${sourceCommit}); no update is needed.\n`)
    return false
  }

  for (const file of removedFiles) {
    rmSync(path.join(templateRoot, 'blog', file))
  }
  for (const file of selectedFiles) {
    const targetPath = path.join(templateRoot, 'blog', file)
    const targetDirectory = path.dirname(targetPath)
    mkdirSync(targetDirectory, { recursive: true })
    writeFileSync(targetPath, normalizedFiles.get(file))
  }

  const updatedMetadata = createThemeSourceMetadata({
    repository: metadata.repository,
    ref: sourceRef,
    commit: sourceCommit,
    templateRoot,
    files: selectedFiles,
  })
  writeFileSync(path.join(templateRoot, metadataPath), `${JSON.stringify(updatedMetadata, null, 2)}\n`)
  process.stdout.write(`Updated AstroPaper files from ${sourceRef} (${sourceCommit}). Review the working tree and commit the changes.\n`)
  return true
}

function parseArguments(args) {
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index]
    if (!['--destination', '--ref', '--commit', '--latest', '--propose', '--record-current'].includes(option)) {
      throw new Error(`Unknown option: ${option}`)
    }
    if (option === '--latest') {
      if (options.latest) throw new Error('Option provided more than once: --latest')
      options.latest = true
      continue
    }
    if (option === '--propose') {
      if (options.propose) throw new Error('Option provided more than once: --propose')
      options.propose = true
      continue
    }
    if (option === '--record-current') {
      if (options.recordCurrent) throw new Error('Option provided more than once: --record-current')
      options.recordCurrent = true
      continue
    }
    const value = args[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Expected a value after ${option}`)
    const key = option.slice(2)
    if (options[key]) throw new Error(`Option provided more than once: ${option}`)
    options[key] = value
    index += 1
  }

  if (Boolean(options.ref) !== Boolean(options.commit)) {
    throw new Error('Provide both --ref and --commit, or use --latest.')
  }
  if (options.latest && options.ref) throw new Error('--latest cannot be combined with --ref or --commit.')
  if (options.recordCurrent && (options.latest || options.ref || options.commit || options.propose)) {
    throw new Error('--record-current cannot be combined with a source version option.')
  }
  if (options.propose && !options.latest && !options.ref) {
    throw new Error('--propose requires --latest or a version supplied with --ref and --commit.')
  }
  if (options.ref && !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(options.ref)) {
    throw new Error(`Expected a version tag such as v6.1.0: ${options.ref}`)
  }
  if (options.commit && !/^[0-9a-f]{40}$/.test(options.commit)) {
    throw new Error(`Expected a full 40-character commit SHA: ${options.commit}`)
  }
  return options
}

async function latestRelease() {
  const response = await fetch('https://api.github.com/repos/satnaing/astro-paper/releases/latest', {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'public-blog-template-updater',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!response.ok) throw new Error(`Could not read the latest AstroPaper release: HTTP ${response.status}`)
  const release = await response.json()
  if (typeof release.tag_name !== 'string') throw new Error('The latest AstroPaper release has no version tag.')
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(release.tag_name)) {
    throw new Error(`Unexpected AstroPaper release tag: ${release.tag_name}`)
  }
  return { ref: release.tag_name }
}

async function updateFromRelease({ destination, ref, expectedCommit, proposeRelease }) {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'astro-paper-update-'))
  const source = path.join(temporaryDirectory, 'astro-paper')
  try {
    execFileSync('git', ['clone', '--quiet', '--depth', '1', '--branch', ref, astroPaperRepository, source], {
      stdio: 'inherit',
    })
    const sourceCommit = git(source, ['rev-parse', 'HEAD'])
    if (expectedCommit && sourceCommit !== expectedCommit) {
      throw new Error(`Unexpected ${ref} commit: ${sourceCommit}`)
    }
    return updateTemplateFromThemeSource({ destination, source, sourceRef: ref, proposeRelease })
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

async function run(args) {
  const options = parseArguments(args)
  const destination = path.resolve(options.destination ?? process.cwd())
  if (options.recordCurrent) return recordCurrentThemeRelease(destination)
  if (options.ref) return updateFromRelease({
    destination,
    ref: options.ref,
    expectedCommit: options.commit,
    proposeRelease: options.propose,
  })

  const release = await latestRelease()
  return updateFromRelease({ destination, ...release, proposeRelease: options.propose })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await run(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
