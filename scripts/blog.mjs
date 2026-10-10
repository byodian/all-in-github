import spawn from 'cross-spawn'
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { release } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { detectWsl, verificationSteps } from './blogPlatform.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(
  readFileSync(join(root, 'scripts/blog.config.json'), 'utf8'),
)
const kernelVersion =
  release() +
  (process.platform === 'linux' && existsSync('/proc/version')
    ? readFileSync('/proc/version', 'utf8')
    : '')
const wsl = detectWsl(process.platform, process.env, kernelVersion)

function execute(
  command,
  args,
  cwd = root,
  { show = false, allowFailure = false } = {},
) {
  if (wsl && /build/i.test([command, ...args, cwd].join(' '))) {
    throw new Error('WSL 禁止执行命令或路径中包含 build 的操作。')
  }
  if (show) console.log(`> ${command} ${args.join(' ')}`)
  const result = spawn.sync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: show ? 'inherit' : 'pipe',
    env: { ...process.env, GIT_MERGE_AUTOEDIT: 'no', GIT_TERMINAL_PROMPT: '0' },
  })
  if (result.error) throw result.error
  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `${command} ${args.join(' ')} 失败。\n${result.stderr || result.stdout || ''}`,
    )
  }
  return result
}

function git(args, cwd = root) {
  return execute('git', args, cwd).stdout.trim()
}

function sourceCommit(ref) {
  const message = git([
    'log',
    ref,
    '--topo-order',
    '-1',
    '--format=%B',
    `--grep=^git-subtree-dir: ${config.prefix}$`,
  ])
  const sha = message.match(/^git-subtree-split: ([a-f0-9]{40,64})$/m)?.[1]
  if (!sha)
    throw new Error(`${ref} 没有 ${config.prefix} 的 subtree 同步记录。`)
  return sha
}

function output(values) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      Object.entries(values)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(''),
    )
  }
}

function verify(worktree) {
  const blog = join(worktree, config.prefix)
  for (const args of verificationSteps(wsl)) {
    execute('pnpm', ['--dir', blog, ...args], worktree, { show: true })
  }
  if (!wsl)
    cpSync(join(blog, 'dist/pagefind'), join(blog, 'public/pagefind'), {
      recursive: true,
    })
  execute('git', ['diff', '--check'], worktree, { show: true })
  console.log(
    wsl
      ? 'WSL 轻量检查通过；未运行构建，生产输出由 GitHub Actions 验证。'
      : '检查、完整构建和 Pagefind 索引生成均通过。',
  )
}

function sync(values) {
  const base = git([
    'rev-parse',
    '--verify',
    `${values['base-ref'] || config.baseBranch}^{commit}`,
  ])
  const previous = sourceCommit(base)
  git(['cat-file', '-e', `${base}:${config.articles}`])
  // Fetch once and merge this exact commit, even if dev advances during verification.
  execute(
    'git',
    ['fetch', '--no-tags', config.repository, config.sourceBranch],
    root,
    { show: true },
  )
  const source = git(['rev-parse', 'FETCH_HEAD'])
  console.log(
    `主仓库基线：${base}\n已同步主题：${previous}\n本次主题：${source}`,
  )
  if (source === previous) {
    output({ changed: 'false', source, base })
    console.log('主题已同步，无需创建分支。')
    return
  }

  // A branch and worktree preserve the committed baseline and any failed merge.
  const branch = `chore/sync-blog-${source.slice(0, 12)}-${base.slice(0, 12)}`
  const commonDir = git([
    'rev-parse',
    '--path-format=absolute',
    '--git-common-dir',
  ])
  const worktree = resolve(
    values.worktree ||
      join(commonDir, 'blog-sync', branch.slice('chore/'.length)),
  )
  mkdirSync(dirname(worktree), { recursive: true })
  execute('git', ['worktree', 'add', '-b', branch, worktree, base], root, {
    show: true,
  })
  console.log(`同步分支：${branch}\n工作目录：${worktree}`)

  try {
    const merge = execute(
      'git',
      ['subtree', 'merge', `--prefix=${config.prefix}`, source, '--squash'],
      worktree,
      { show: true, allowFailure: true },
    )
    const merging =
      execute('git', ['rev-parse', '--verify', 'MERGE_HEAD'], worktree, {
        allowFailure: true,
      }).status === 0
    if (merge.status !== 0 && !merging)
      throw new Error('subtree 合并失败，尚未进入可解决的合并状态。')

    // Always restore articles, including cleanly merged upstream edits/additions/deletions.
    git(
      [
        'restore',
        `--source=${base}`,
        '--staged',
        '--worktree',
        '--',
        config.articles,
      ],
      worktree,
    )
    const conflicts = git(['diff', '--name-only', '--diff-filter=U'], worktree)
    if (conflicts) throw new Error(`源码冲突需要手动处理：\n${conflicts}`)
    if (merging) {
      git(['commit', '--no-edit'], worktree)
    } else if (git(['diff', '--cached', '--name-only'], worktree)) {
      git(
        [
          'commit',
          '-m',
          'fix(blog): preserve articles during theme synchronization',
        ],
        worktree,
      )
    }
    git(['diff', '--exit-code', base, 'HEAD', '--', config.articles], worktree)
    execute('git', ['diff', '--check', base, 'HEAD'], worktree, { show: true })
    if (!values['prepare-only']) verify(worktree)

    const report = join(
      commonDir,
      'blog-sync',
      `${branch.slice('chore/'.length)}.md`,
    )
    mkdirSync(dirname(report), { recursive: true })
    writeFileSync(
      report,
      `主题远端更新同步到 \`${config.prefix}/\`，文章路径与内容保持主仓库基线不变。\n\n` +
        `- 来源：${config.repository}，\`${config.sourceBranch}\`\n` +
        `- 主题提交：\`${previous}\` → \`${source}\`\n` +
        `- 主仓库基线：\`${base}\`\n` +
        `- 文章一致性检查：通过\n` +
        `- 验证：${values['prepare-only'] ? '尚未执行' : wsl ? 'WSL 轻量检查通过，未运行构建' : '完整验证通过'}\n\n` +
        '请使用 **Create a merge commit** 合并，保留 subtree 历史；合并前确认验证结果和主仓库基线仍有效。\n\n' +
        '```text\n' +
        git(['diff', '--stat', base, 'HEAD'], worktree) +
        '\n```\n',
    )
    output({ changed: 'true', source, base, branch, worktree, report })
    console.log(
      `同步完成。摘要：${report}\n检查差异：git -C "${worktree}" diff ${base} HEAD\n` +
        `合并已验证的分支：git merge --no-ff ${branch}\n` +
        `合并后清理：git worktree remove "${worktree}"\n` +
        '当前工作区未切换分支；本地流程不会推送。',
    )
  } catch (error) {
    throw new Error(
      `${error.message}\n已保留工作目录：${worktree}\n` +
        `解决源码冲突并暂存后，在该目录执行 git commit --no-edit（仅合并未完成时）。\n` +
        `继续验证：npm run blog:verify -- --worktree "${worktree}"\n` +
        `复查文章：git -C "${worktree}" diff --exit-code ${base} HEAD -- ${config.articles}`,
    )
  }
}

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'base-ref': { type: 'string' },
      worktree: { type: 'string' },
      'prepare-only': { type: 'boolean' },
    },
  })
  const command = positionals[0] || 'help'
  if (positionals.length > 1) throw new Error('只接受一个操作名称。')
  switch (command) {
    case 'help':
      console.log(
        `主题源码：${config.repository} (${config.sourceBranch})\n` +
          `本地主题：${resolve(root, config.localRepository)}\n文章：${config.articles}\n\n` +
          'npm run blog:edit     打开主题仓库，修改、提交并推送主题源码\n' +
          'npm run blog:status   查看本地状态、远端与已同步版本\n' +
          'npm run blog:sync     在独立 worktree 同步远端并保留文章、验证\n' +
          'npm run blog:verify -- --worktree <目录>   继续验证\n\n' +
          '日常流程：维护主题 → 推送 dev → 等待或手动触发同步 workflow → 检查并合并 PR。\n' +
          '本地 sync 默认基于已提交的 main；未提交内容不参与同步。\n' +
          'Windows、macOS、原生 Linux 执行完整验证；WSL 只执行轻量检查。\n' +
          'sync --base-ref <引用> 可指定基线；--prepare-only 只准备合并，供 CI 验证。\n' +
          '操作说明：docs/blog-maintenance.md',
      )
      break
    case 'edit': {
      const local = resolve(root, config.localRepository)
      if (!existsSync(local))
        throw new Error(
          `本地主题仓库不存在：${local}\n请先 git clone --branch ${config.sourceBranch} ${config.repository} "${local}"`,
        )
      console.log(
        `在独立主题仓库维护源码，提交并推送后同步。当前分支：${git(['branch', '--show-current'], local)}`,
      )
      execute('code', ['--new-window', local], root, { show: true })
      break
    }
    case 'status': {
      const local = resolve(root, config.localRepository)
      console.log(
        `主项目分支：${git(['branch', '--show-current'])}\n主项目状态：\n${git(['status', '--short']) || '干净'}\n` +
          `${config.baseBranch} 已同步主题：${sourceCommit(config.baseBranch)}\n` +
          `远端主题：${git(['ls-remote', config.repository, `refs/heads/${config.sourceBranch}`])}\n本地主题：${local}`,
      )
      if (existsSync(local))
        console.log(
          `主题分支：${git(['branch', '--show-current'], local)}\n主题状态：\n${git(['status', '--short'], local) || '干净'}`,
        )
      else console.log('主题尚未克隆，blog:edit 会显示初始化命令。')
      break
    }
    case 'sync':
      sync(values)
      break
    case 'verify':
      verify(resolve(values.worktree || root))
      break
    default:
      throw new Error(`未知操作：${command}，请运行 npm run blog:help。`)
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
