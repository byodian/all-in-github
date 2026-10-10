# Blog 日常维护

维护者：BAI YONGJIAN

主题源码在 `byodian/astro-paper` 的 `dev` 分支维护，主仓库只单向接收 subtree
更新。文章在主仓库的 `blog/src/content/blog/` 维护。日常只需记住：

```sh
npm run blog:help
```

首次使用先安装主仓库维护工具的依赖：

```sh
pnpm install --frozen-lockfile --ignore-scripts
```

本地需要 Node.js 22.12.0 以上、pnpm 和包含 subtree 的 Git；CI 使用 Node.js 24
和 pnpm 11.3.0。命令入口适用于 Bash、Zsh、PowerShell、CMD 和 Git Bash，
子进程通过 `cross-spawn` 处理 Windows 的 `.cmd` 启动方式及含空格的路径。
见 [cross-spawn 说明](https://github.com/moxystudio/node-cross-spawn)。

## 修改主题

在主项目根目录执行：

```sh
npm run blog:edit
```

该命令使用 VS Code 的 `code` 命令打开独立主题仓库，不会切换或修改其分支。
默认路径为 `../astro-paper`；首次使用时若尚未克隆，命令会显示克隆指令。
若没有安装 `code` 命令，可以直接用自己的编辑器打开该目录。

在主题仓库完成修改、验证、提交，并将需要同步的更新推送到远端 `dev`。
文章仍在主仓库维护，主题源码在独立主题仓库维护。

来源地址、来源分支、本地主题路径、subtree 路径、文章路径和主仓库基线分支
统一配置在 [`scripts/blog.config.json`](../scripts/blog.config.json)。修改主分支或
文章目录时，还需同步调整 workflow 的事件过滤器和验证路径。

## 自动同步 PR

主仓库的 **Sync blog theme** workflow 会：

1. 每月 1 日北京时间 10:17 检查主题远端；GitHub 的定时执行可能延迟。
2. 在主仓库 `main` 的文章发生变化时再次检查，刷新尚未合并的同步 PR。
3. 支持从 Actions 页面使用 **Run workflow** 立即检查。
4. 有主题更新时，在独立 worktree 中合并确定的主题提交。
5. 恢复主仓库基线的全部文章，验证路径和内容完全一致。主题的示例文章、
   文章删除、改名和自动合并的正文修改都不会进入最终同步结果。
6. 运行轻量检查、完整构建和 Pagefind 索引生成，通过后创建或更新同一个 PR。

没有新主题提交时不会创建分支或 PR。源码冲突或验证失败会停止流程；可在
Actions 日志查看失败原因，再使用本地同步方式处理。

`automation/sync-blog` 是此 workflow 专用的远端分支。更新时会从最新 `main`
重新生成同步结果，并仅对该分支使用显式 `--force-with-lease`。不要在该分支
手动开发；人工处理使用本地生成的独立同步分支，并提交单独的 PR。

首次启用需要仓库允许 Actions 创建 PR：

**Settings → Actions → General → Workflow permissions → Allow GitHub Actions
to create and approve pull requests**。

无需新增个人令牌，使用主仓库的 `GITHUB_TOKEN`，workflow 显式声明
`contents: write` 和 `pull-requests: write` 权限。按 GitHub 当前机制，由
`GITHUB_TOKEN` 创建或更新 PR 后，PR workflow 可能处于需要批准的状态；
在 PR 上选择 **Approve workflows to run** 后，会再次验证合并结果的文章一致性
和完整构建。创建 PR 前的验证已在同步 workflow 内执行，不依赖该触发机制。
见 [GitHub workflow 触发说明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)。

检查 PR 的变更和验证结果后，使用 **Create a merge commit** 合并，保留 subtree
提交的历史关系；不要对同步 PR 使用 Squash 或 Rebase。人工合并到 `main` 后，
已有部署 workflow 会生成并发布站点。

合并前若 `main` 又有新提交，应等待同步刷新或重新手动触发。若启用了分支保护，
建议将 `verify-merge` 设为必需检查，并要求分支在合并前保持最新；这需要在仓库
设置中配置，本次代码不修改远端仓库设置。

## 本地同步

先查看当前状态：

```sh
npm run blog:status
npm run blog:sync
```

默认基于本地已提交的 `main`。同步不会切换当前分支，也不会改变原工作区的
未提交或未跟踪文件；这些内容不会进入同步基线。需要包含新文章时，先把文章
提交到 `main`。需要使用最新远端主分支时：

```sh
git fetch origin main
npm run blog:sync -- --base-ref origin/main
```

脚本先获取远端主题分支，再固定 `FETCH_HEAD` 作为本次主题提交，随后执行
`git subtree merge --squash`。这与 subtree pull 的获取和合并过程一致，同时
避免验证期间来源分支前进导致本次版本不明确。

工作目录默认放在 Git 公共目录的 `blog-sync/` 下，分支名称包含主题和主仓库
基线的提交 ID。可指定工作目录：

```sh
npm run blog:sync -- --worktree ../all-in-github-blog-sync
```

成功后会输出工作目录、摘要文件、差异检查、合并和清理命令。检查后在主仓库
`main` 合并输出的分支，合并前应提交主仓库需要保留的工作区改动。示例：

```sh
git switch main
git merge --no-ff <输出的同步分支>
git worktree remove <输出的工作目录>
git branch -d <输出的同步分支>
```

本地流程不会推送。合并后再按项目现有流程推送。重复运行同一主题版本和同一
基线时，若同步分支仍存在，脚本会拒绝覆盖；应使用已有结果或先处理并清理该分支。

## 冲突或检查失败

文章始终先恢复到基线；源码冲突保持未解决状态。脚本保留工作目录，输出冲突
文件和继续验证的命令。进入该目录解决源码冲突、暂存改动；如果合并仍未完成，
再执行 `git commit --no-edit`。已经完成合并但检查失败时，修复后正常提交即可。

```sh
npm run blog:verify -- --worktree <输出的工作目录>
git -C <输出的工作目录> diff --exit-code <输出的主仓库基线> HEAD -- blog/src/content/blog
```

文章检查无输出且退出码为 0，表示已提交的路径和内容与基线完全一致。处理失败
后不要重新执行同步覆盖现场；先完成现有分支的处理或明确放弃该次同步。

## 按运行平台验证

本地同步根据 Node.js 实际运行的操作系统选择验证方式，终端外观不影响判断。
例如 Windows Terminal 内运行 WSL 时仍按 WSL 处理，在 PowerShell 中运行 Windows
Node.js 则按原生 Windows 处理。

| 运行环境                   | 依赖安装                         | 验证内容                                              |
| -------------------------- | -------------------------------- | ----------------------------------------------------- |
| WSL                        | 冻结锁文件，跳过生命周期脚本     | Astro 检查、ESLint、Prettier、Git 差异检查            |
| 原生 Linux、macOS、Windows | 冻结锁文件，正常执行生命周期脚本 | 上述检查、Astro 完整构建、Pagefind 索引及静态资产复制 |

构建和检查直接调用工具，不调用主题仓库中可变的包脚本。Pagefind 资产使用
Node.js 的文件复制 API 处理，不依赖 Unix `cp` 命令。需要单独验证当前主项目时：

```sh
npm run blog:verify
npm run test:blog-sync
```

`--prepare-only` 仅供 CI 或需要先处理合并的场景使用，跳过依赖安装和全部验证；
它不表示验证通过，也不应据此直接合并。

WSL 下不会运行构建，执行器还会拒绝命令、参数或工作路径中包含 `build`
（忽略大小写）的操作。该限制严格限定在 Linux 下检测到 WSL 的环境，不应用于
原生 Linux、macOS 或 Windows。GitHub Actions 的 Ubuntu runner 执行完整验证。

### 原生 Windows 的仓库文件名限制

当前历史文章存在带冒号的文件名，例如 `2024-01-24_22:16:57_Java日期时间格式转换.md`。
Windows 文件名规则禁止冒号，因此这些文件无法直接在原生 Windows 文件系统中
检出；Git Bash 使用 Windows Node.js 时同样受此限制。见
[Microsoft 文件命名规则](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file)。

命令启动层已适配 Windows，但完整仓库在原生 Windows 使用前仍需要一次文件名和
生成器迁移，并验证文章地址及引用。当前 Windows 用户可在 WSL 的 Linux 文件系统
中维护，或通过 GitHub Actions 远端同步。本次未迁移文章文件名。

同步测试使用临时 Git 仓库，覆盖文章冲突、静默合并、增删改名、源码冲突、
脏工作区隔离、无更新、后续再次同步、相同时间戳的版本查询、验证失败保留现场
和 WSL 限制，不操作真实主题远端。

`Test blog maintenance tools` workflow 在 Ubuntu、macOS 和 Windows 上执行相同测试，
使用仅检出工具文件的工作区和可移植的临时文章，避免历史文章文件名阻塞工具测试。
完整站点的验证仍由同步 workflow 的 Ubuntu runner 执行。

历史升级记录和底层手工操作见 [blog-upgrade.md](blog-upgrade.md)。
