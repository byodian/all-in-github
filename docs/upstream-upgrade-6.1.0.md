# AstroPaper 6.1.0 升级记录

维护者：BAI YONGJIAN

## 上游基线

本项目从 AstroPaper 5.5.0 升级到最新正式版
[v6.1.0](https://github.com/satnaing/astro-paper/releases/tag/v6.1.0)，
对应提交 `4c33a60529f9c443145a89fe526ff231c009272d`。
本项目与上游的共同祖先为 `aad5ac67e43e44a7fcdaabac4f7358e0ef4d2eb2`。

本次查看到的上游 `main` 为 `35cfa7fbe0b897306d27670d3819e55d5205f3dd`，
其中已包含 Astro 7 迁移及后续修复。本次使用正式发布的 6.1.0 作为可复现的升级基线。
另外移植了 `main` 上与 Astro 7 无关的四个修复：
[重复标题的页面过渡](https://github.com/satnaing/astro-paper/pull/662)、
[上一篇和下一篇方向](https://github.com/satnaing/astro-paper/pull/674)、
[表格列对齐](https://github.com/satnaing/astro-paper/pull/668)、
[跳转到正文时的键盘焦点](https://github.com/satnaing/astro-paper/pull/665)。

## 更新内容

| 项目         | 升级前 | 升级后（锁文件版本） |
| ------------ | ------ | -------------------- |
| AstroPaper   | 5.5.0  | 6.1.0                |
| Astro        | 5.x    | 6.4.2                |
| Tailwind CSS | 4.1.x  | 4.3.0                |
| TypeScript   | 5.x    | 6.0.3                |
| ESLint       | 9.x    | 10.4.1               |
| Pagefind     | 1.3.x  | 1.5.2                |
| Satori       | 0.15.x | 0.26.0               |

主要变化来自 [6.0.0 发布说明](https://github.com/satnaing/astro-paper/releases/tag/v6.0.0)
和 [6.1.0 发布说明](https://github.com/satnaing/astro-paper/releases/tag/v6.1.0)：

- 用户配置统一到根目录 `astro-paper.config.ts`，支持类型提示。
- 使用 Astro 6 的内容、字体 API；支持 Markdown 和 MDX。
- 增加图片灯箱和 GitHub 风格提示块。
- 迁移主题切换脚本、文章布局、分享及编辑组件，删除已被替代的旧接口。
- 采用新的国际化文案层、路径工具和社交图标目录。
- 同步依赖、锁文件、编辑器配置，CI 使用 Node.js 24、pnpm 11.3.0。
- Docker 使用 Node.js 24、pnpm 11.3.0，并在安装时读取 `pnpm-workspace.yaml`。

## 本项目适配

- 保留站点域名 `https://byodian.github.io/`、标题 `All in GitHub`、
  部署路径 `/all-in-github` 和时区 `Asia/Shanghai`。
- 在配置类型中增加 `site.base`，供 `astro.config.ts` 读取。
- 将原来的首页标题、介绍和 README 地址迁移到 `home` 配置。
- 保留已有社交链接、分享链接及主仓库的文章编辑地址。
- 默认作者按 Git 配置设为 `BAI YONGJIAN`。已有文章的署名及正文保持原样。
- **保留 `src/content/blog` 作为文章目录**，避免改变主仓库 GitHub Actions 的写入位置。
  Astro 内容集合名称改为 `posts`，目录仍由 `src/content.config.ts` 的 `BLOG_PATH` 指定。
- About 正文迁移到 `src/content/pages/about.md`，由 `src/pages/about.astro` 渲染；
  更新其中的站点配置说明，访问地址仍为 `/all-in-github/about/`。
- RSS 自动发现链接使用资源路径工具，避免把 `rss.xml` 当作页面路径添加尾部斜杠。
- robots 中的 sitemap URL 加上部署子路径。
- 保留已有 `public/astropaper-og.jpg` 和 `favicon.svg`，去掉指向不存在的 `favicon.ico` 的链接。
- 上游默认字体不含中文字形，实际验证发现中文文章 OG 标题显示为方框。
  加入本地 Noto Sans SC 字体，通过 Astro 本地字体提供器和共享的 `getOgFonts` 加载；
  站点及文章 OG 路由都支持中文，不需要在线下载中文字形。
  字体来自 [Noto CJK 官方仓库](https://github.com/notofonts/noto-cjk/blob/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf)，
  文件约 8.3 MB，原始许可证保存在 `docs/fonts/NotoSansSC-OFL.txt`。
  字体 SHA-256 为 `faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9`。
- 原始导入文章从格式化检查中排除，保留其原始格式和换行。

## 本地验证

当前环境为 WSL，依照项目规则没有执行构建。安装依赖时使用
`pnpm install --ignore-scripts --frozen-lockfile`，跳过依赖生命周期脚本。

可用的轻量检查：

```sh
pnpm exec astro check
pnpm run lint
pnpm run format:check
git diff --check
```

已验证类型检查、Lint、格式检查，以及开发服务器上的首页、文章分页、标签、
归档、About、搜索页面、静态图标、RSS、robots 和六篇已有文章。
逐字节检查确认 `src/content/blog` 中的原始文章没有改动。

另外用临时 MDX 文章验证了 JSX 表达式和提示块渲染、灯箱脚本的输出，验证后删除测试内容。
站点及中文文章的 OG PNG 路由返回正常，实际查看图片确认中文标题正确显示。
六篇原始文章的 OG 路由均返回 PNG；逐篇检查上一篇指向较旧文章、下一篇指向较新文章。
用两篇同名临时文章检查列表中的页面过渡名称互不重复，并检查 Markdown 表格的对齐属性。
最终类型检查共检查 56 个文件，结果为 0 错误、0 警告、0 提示。

搜索页面可在开发模式访问，但 Pagefind 索引及生产输出需要在非 WSL 环境中验证。
本次没有运行 Docker 或 GitHub Actions。

## 接入主仓库

通过 git-subtree 同步到 `all-in-github` 的 `blog` 目录时，父仓库的部署任务也需
使用 **Node.js >= 22.12.0**，建议与本项目 CI 一致使用 Node.js 24。
内容生成器仍可写入 `blog/src/content/blog`；修改站点配置时，应编辑
`blog/astro-paper.config.ts`，不再编辑内部默认值模块 `blog/src/config.ts`。

字体使用上游的 Google Sans Code 和 Astro Fonts API。当前机器需要通过已配置的
HTTP/HTTPS 代理访问 Google Fonts；Node.js 26 下验证时使用
`NODE_USE_ENV_PROXY=1 pnpm run dev --host 127.0.0.1`。
这属于本机网络设置，无须写入站点配置。字体 API 说明见
[Astro Font Provider API](https://docs.astro.build/en/reference/font-provider-reference/)。
