# 升级 blog 源码并保留文章

维护者：BAI YONGJIAN

日常维护请使用[统一维护入口和自动同步流程](blog-maintenance.md)，从
`npm run blog:help` 开始。本文保留仓库关系、底层手工操作和历史升级记录。

## 仓库关系

`all-in-github` 使用 **git subtree** 将 `byodian/astro-paper` 的 `dev` 分支同步到
`blog/`，不是 git submodule。主题文件和文章都由主仓库直接跟踪，不需要
`git submodule update`，也不需要删除或重新添加 `blog/`。

- 主题来源：<https://github.com/byodian/astro-paper>，分支为 `dev`。
- 主仓库文章目录：`blog/src/content/blog/`。
- 内容生成器：`actions/src/config.ts` 的 `FILE_PATH_PREFIX` 为 `blog/src/content`，
  `makeBlog.ts` 和 `makeNote.ts` 在其下的 `blog/` 目录写入文章。
- AstroPaper 6 的内容集合名称为 `posts`，但磁盘目录仍是 `src/content/blog`，
  由 `blog/src/content.config.ts` 的 `BLOG_PATH` 指定。
- 站点配置在 `blog/astro-paper.config.ts`；`blog/src/config.ts` 负责解析配置和默认值。

建议在主题仓库维护主题源码，在主仓库维护文章。主题仓库中仍有历史文章，
同步时要检查文章目录，避免旧内容覆盖主仓库的新内容。

## 从远端同步

先将主题仓库需要升级的提交推送到远端 `dev`。以下操作在 `all-in-github` 根目录执行。

1. 检查工作区，先提交需要保留的改动；`git status --short` 应没有输出。
   备份分支只保护已提交文件，不保护未跟踪或未提交的文章。

   ```sh
   git status --short
   git ls-remote https://github.com/byodian/astro-paper.git refs/heads/dev
   ```

2. 为升级前的状态创建备份分支，并在独立分支执行升级。每次升级使用不同的分支名称，
   不要覆盖已有备份。下面使用日期作为示例。

   ```sh
   git branch backup/blog-before-upgrade-20261009
   git switch -c chore/upgrade-blog-20261009
   git subtree pull --prefix=blog https://github.com/byodian/astro-paper.git dev --squash
   ```

   这会从远端获取 `dev` 并合并主题更新；无冲突时自动创建合并提交。
   不要通过复制整个目录或重新执行 `git subtree add` 升级。

3. 如果出现文章的删除、改名或修改冲突，按本项目“保留主仓库文章”的要求，
   从备份恢复整个文章目录，同时更新暂存区以标记文章冲突已解决：

   ```sh
   git restore --source=backup/blog-before-upgrade-20261009 --staged --worktree -- blog/src/content/blog
   git diff --cached --exit-code backup/blog-before-upgrade-20261009 -- blog/src/content/blog
   git diff --name-only --diff-filter=U
   ```

   这会保留升级前文章的路径、正文和 frontmatter，也会排除主题仓库新增的文章。
   如有其他源码冲突，逐个解决并暂存；确认最后一条命令没有输出后完成合并：

   ```sh
   git commit --no-edit
   ```

4. 即使没有冲突，也必须检查文章，因为 Git 可能自动合并旧文章改动：

   ```sh
   git diff --exit-code backup/blog-before-upgrade-20261009 HEAD -- blog/src/content/blog
   ```

   无输出且退出码为 0，表示已提交的文章路径和内容完全一致。如果有差异，
   恢复文章目录并单独提交，再重复上面的检查：

   ```sh
   git restore --source=backup/blog-before-upgrade-20261009 --staged --worktree -- blog/src/content/blog
   git commit -m "fix(blog): preserve articles during theme upgrade"
   ```

## 依赖与验证

AstroPaper 6.1.0 要求 Node.js >= 22.12.0。主仓库 `.github/workflows/deploy.yml`
使用 Node.js 24 和 pnpm 11.3.0，与主题仓库 CI 一致。后续升级时同时检查
`blog/package.json`、锁文件、`blog/pnpm-workspace.yaml` 和主仓库部署配置。

在 WSL 中，禁止运行命令文本包含 `build`（忽略大小写）的命令，也禁止通过脚本
间接执行这样的命令。安装时跳过生命周期脚本，使用以下轻量检查：

```sh
pnpm --dir blog install --frozen-lockfile --ignore-scripts
pnpm --dir blog exec astro check
pnpm --dir blog lint
pnpm --dir blog format:check
git diff --check
```

检查升级差异并通过验证后，将升级分支合并到 `main`。主仓库部署流程在
GitHub 的 `ubuntu-latest` 非 WSL 环境执行完整构建和 Pagefind 索引生成。
本地轻量检查不能替代生产输出、搜索索引及部署验证。

## 2026-10-09 同步记录

- 来源：远端 `byodian/astro-paper` 的 `dev`，提交
  `4833078a1b57130ba88810baca93aed4b0774290`，AstroPaper 版本为 6.1.0。
- 主仓库升级前提交：`d3b6b736cb276fa292301f1ab57d8a54710e0987`。
- 备份分支：`backup/blog-before-upgrade-20261009`。
- 本次在主仓库 `main` 上同步，主题合并提交为 `431489b`。
- 合并时出现“Windows 常用软件”文章的改名/删除冲突，并自动回退了
  Mybatis-Plus typeHandler 文章的一部分内容；从备份恢复整个文章目录后完成合并。
- 升级前的 15 个文章文件全部保留，路径和内容不变。
- 新版配置保留站点域名、`/all-in-github` 部署路径、时区及主仓库文章编辑地址。
- 主仓库部署配置更新为 Node.js 24、pnpm 11.3.0；本地安装使用 pnpm 11.1.3，
  冻结锁文件并跳过依赖生命周期脚本，未修改锁文件。
- 本次验证：Astro 检查 56 个文件，0 错误、0 警告、0 提示；Lint、主题格式检查、
  升级文档与部署配置的格式检查、`git diff --check` 全部通过。
- 已将 15 个文章文件与升级前 Git blob 逐字节比较，全部一致。
- WSL 中未运行构建；生产站点、Pagefind 索引和 GitHub Pages 部署需由远端流程验证。

主题仓库的详细迁移记录见
[AstroPaper 6.1.0 升级记录](../blog/docs/upstream-upgrade-6.1.0.md)。
Git subtree 的合并规则见
[Git 官方说明](https://github.com/git/git/blob/master/contrib/subtree/git-subtree.adoc)。

## 2026-10-09 追加同步记录

- 从远端 `byodian/astro-paper` 的 `dev` 同步到提交
  `d5c88cce0ae5df863ee35377f7e8d4250fbe29e7`，新增 About 页面项目介绍更新。
- 同步前提交为 `215cfa0`，已创建备份分支
  `backup/blog-before-sync-20261009`，在 `chore/sync-blog-20261009` 分支完成同步。
- 子树合并提交为 `bf4d29b`，没有冲突，AstroPaper 版本仍为 6.1.0。
- 已比较整个 `blog/src/content/blog/` 目录与备份提交，文章路径与内容完全一致。
- Astro 检查 56 个文件，0 错误、0 警告、0 提示；About 页面及文章排版指南的
  Prettier 检查、skill 格式校验和 `git diff --check` 全部通过。
- WSL 下未运行构建；推送主分支后由 GitHub Actions 生成并发布生产站点。
