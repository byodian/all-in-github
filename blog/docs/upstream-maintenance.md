# 自动合并上游最新提交

维护者：BAI YONGJIAN

## 同步链路

```text
satnaing/astro-paper/main
    → 自动 merge、验证、推送 → byodian/astro-paper/dev
    → 现有月度 subtree 同步 → byodian/all-in-github/main 的 blog/
```

本仓库跟踪上游 `main` 的最新提交，包括尚未发布为正式版本的改动。
不会把 fork 重置为上游，也不会使用 GitHub 的强制 fork 同步覆盖本地定制。
主仓库继续维护文章，主题源码在本仓库维护。

来源、目标分支和需要保留的内容统一配置在
[`scripts/upstream.config.json`](../scripts/upstream.config.json)。

## 定时与手动执行

**Sync upstream into dev** 每月 25 日北京时间 10:17 执行，早于主仓库每月
1 日的 subtree 同步。GitHub 定时任务可能延迟；也可在 Actions 页面选择
**Run workflow** 随时检查。定时和手动触发都直接更新 `dev`，不需要人工合并 PR。

工作流执行以下步骤：

1. 先运行临时 Git 仓库中的同步测试。
2. 基于最新 `origin/dev` 创建独立 worktree，获取并固定本次上游提交 SHA。
3. 使用普通 `git merge --no-ff` 合并，保留上游的祖先关系。
4. 恢复 fork 基线中的文章、站点配置、About、favicon、默认 OG 图片及本地字体。
   上游样例文章的新增、删除、改名和自动合并也会被排除。
5. 对全部其他源码进行正常合并。源码冲突停止流程，不自动选择任意一侧。
6. 冻结锁文件安装依赖，执行 Astro 检查、ESLint、Prettier、完整构建和 Pagefind。
   再次确认受保护文件一致，且验证没有修改任何已跟踪文件或新增非忽略文件。
7. 检查通过后，用普通 push 更新 `dev`。验证期间如果远端 `dev` 前进，Git 拒绝
   非快进推送；需要重新运行工作流，不覆盖他人的提交。

上游已经是 fork 的祖先时直接退出，不创建 worktree 或新提交。即使上游只改了
受保护内容，也会保留合并关系，避免每次重复处理同一版本。

工作流只使用本仓库 `GITHUB_TOKEN` 的 `contents: write` 权限，不需要跨仓库令牌。
分支保护如果禁止 Actions 直接推送，更新步骤会失败；本次实现不修改保护设置。
使用 `GITHUB_TOKEN` 推送一般不会再次触发 push workflow，因此所有验证都在更新
`dev` 前执行。见 [GitHub 工作流触发规则](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)。

合并后主仓库仍通过既有月度任务拉取；需要立即更新站点时，在 `all-in-github`
手动运行 **Sync blog theme**，检查并合并生成的 subtree PR。

## 本地准备与验证

在本仓库执行：

```sh
npm run test:upstream-sync
npm run upstream:sync
```

本地同步默认以已提交的 `dev` 为基线，读取配置中的上游 `main`。
当前分支及未提交内容不会被切换、提交或覆盖。指定远端最新 fork 基线：

```sh
git fetch origin dev
npm run upstream:sync -- --base-ref origin/dev
```

也可以显式指定完整来源引用，例如 `--source-ref refs/tags/v6.1.0`。
这只影响本次本地运行，不改变 CI 跟踪 `main` 的策略。

脚本只准备合并，不执行安装、验证或推送。输出同步分支、worktree 路径及其
`docs/upstream-sync-latest.md` 记录。在输出的 worktree 中进行验证；WSL 使用：

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm exec astro check
pnpm exec eslint .
pnpm exec prettier --check .
git diff --check
git status --short
```

WSL 严禁运行含 `build` 的命令，本地没有运行构建。GitHub Actions 使用非 WSL
Ubuntu runner 执行完整构建和搜索索引验证。轻量检查不能证明生产输出通过。

本地检查后，把输出的分支通过普通 merge 合入 `dev`，再按正常流程推送。
不要 squash 或 rebase 上游同步提交，否则会丢失用于判断已合并版本的祖先关系。
相同 fork 基线和上游版本的同步分支已存在时，工具会拒绝覆盖，使用现有 worktree。

## 冲突或验证失败

本地失败会保留 worktree，输出源码冲突列表。解决冲突并暂存，合并尚未完成时
执行 `git commit --no-edit`，然后重新验证。已完成合并但检查失败时正常提交修复。
修复期间继续保持配置中受保护路径与 fork 基线一致。

CI 失败不会更新 `dev`，会上传 `upstream-sync-recovery`，保留 14 天：

- `upstream-history.bundle`：包含 fork 分支及本次固定的上游提交。
- `upstream-worktree.tar.gz`：包含当时的源码和冲突标记，不含依赖及生成产物。
- 工作区与暂存区 patch、Git 状态：用于检查自动合并结果和未解决文件。

恢复时先从 bundle 克隆，检出对应同步分支，再解压源码查看现场。
对于未完成的 merge，在恢复仓库重新合并记录中的上游 SHA，再应用人工解决的
文件、暂存并提交。归档不包含 Git 合并状态，不能只解压后直接继续原 merge。

## 历史基线修复

2026-10-09 的 `4833078` 已将主题升级为 v6.1.0，并保留本站定制，
但该提交只有一个父提交，没有记录上游 v6.1.0 的祖先关系。
因此本次自动化先通过一次 `git merge --no-ff -s ours` 合并
`4c33a60529f9c443145a89fe526ff231c009272d`，只补记已完成的历史升级，
提交前后文件树完全一致。升级依据见 [原升级记录](upstream-upgrade-6.1.0.md)。

这是一项一次性历史修复。后续同步必须使用普通 merge，不能再次用 `ours`
策略跳过真正的上游源码更新。
