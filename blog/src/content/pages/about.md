---
title: "About"
---

All in GitHub 是一个用 GitHub Issues 管理内容的个人博客项目。你可以在 Issue 评论中记录代码片段、排查过程和灵感，也可以用完整的 Issue 撰写长文章；GitHub Actions 会将内容转换为 Markdown，并自动发布到 GitHub Pages。

## 项目特点

- **两种写作方式**：带有 `Note` 标签的 Issue 用于收集笔记，每条评论是一篇文章；带有 `Blog` 标签的 Issue 用于长文章，通过 `Publishing` 标签触发发布。
- **本地编辑器**：Note Editor 支持创建和编辑笔记评论、修改长文章的标题与正文、预览内容，并在浏览器中保存草稿。
- **自动发布**：笔记评论的创建或修改会触发内容更新；长文章生成后，`Publishing` 标签改为 `Published`，生成的 Markdown 保存在仓库中。
- **阅读体验**：支持亮暗主题、全文搜索、标签、归档、RSS、代码高亮、提示块和图片灯箱（点击放大查看）；中文标题也可以生成分享预览图。

博客基于 [AstroPaper 6.1.0](https://github.com/satnaing/astro-paper/releases/tag/v6.1.0)，使用 Astro 6 和 Tailwind CSS 4，并保留适合 GitHub Pages 子路径部署的项目配置。

## 如何使用

> [!IMPORTANT]
> 请严格按照步骤进行项目设置。

### **[Fork](https://github.com/byodian/all-in-github/fork) 项目**

复刻项目后，请检查并开启 GitHub Issues 和 Actions。

- 打开 Issues：Settings -> General -> Features -> Issues
- 打开 Workflows：Actions -> I understand my workflows, go ahead and enable them

### **项目配置**

- 修改 GitHub Actions 配置，文件位置 [actions/src/config.ts](https://github.com/byodian/all-in-github/blob/main/actions/src/config.ts)

  ```ts
  // GitHub 仓库信息
  export const OWNER = "byodian"; // 替换为你的 GitHub 账号名称
  export const REPO = "all-in-github"; // 替换为你的仓库名称
  ```

- 修改博客配置，文件位置：[blog/astro-paper.config.ts](https://github.com/byodian/all-in-github/blob/main/blog/astro-paper.config.ts)

  ```ts
  import { defineAstroPaperConfig } from "./src/types/config";

  export default defineAstroPaperConfig({
    site: {
      url: "https://byodian.github.io/", // 替换成你的 GitHub Pages 主页
      base: "/all-in-github", // 指定 GitHub Pages 子路径
      author: "BAI YONGJIAN", // 替换成你的 Git 配置中的英文姓名
      profile: "https://byodian.github.io/",
      description:
        "A minimal, responsive, GitHub Actions powered and SEO-friendly Astro blog.",
      title: "All in GitHub",
    },
    home: {
      title: "Hello World!",
      description: "使用 GitHub Issues 管理博客内容。",
      readmeUrl: "https://github.com/byodian/all-in-github#readme",
    },
    features: {
      editPost: {
        enabled: true,
        url: "https://github.com/byodian/all-in-github/edit/main/blog/",
      },
    },
  });
  ```

- 修改社交媒体链接：在 `blog/astro-paper.config.ts` 中设置 `socials` 和 `shareLinks`。

文章仍写入 `blog/src/content/blog/`，与 GitHub Actions 的现有生成目录一致，支持 Markdown 和 MDX。

博客运行环境要求 Node.js >= 22.12.0；本项目的部署流程使用 Node.js 24 和 pnpm 11.3.0。

### **创建 PAT**

Personal access tokens（简称 PAT），用于在构建阶段，根据评论生成静态博客内容并提交到主分支时，触发部署 GitHub Page Workflow。

打开 [Fine-grained tokens](https://github.com/settings/personal-access-tokens) 页面，创建一个具有最小权限的 token，设置如下：

- Expiration：**No expiration**
- Repository access：**Only select repositories**
- Permissions:
  - "Contents" repository permissions (Read and write)
  - "Issues" repository permissions (Read and write)
  - "Workflows" repository permissions (Read and write)

创建完成后，复制保存生成的 token。

### **创建项目环境变量**

打开**项目** Settings -> Secrets and variables -> Actions，创建一个 **Repository secrets**，其中：

- Name: `ACTIONS_DEPLOY_KEY`
- Value: 上一步生成的 token

### **创建 GitHub 标签**

创建 Issues 标签（labels）：**Note**、**Blog**、**Publishing**

### **创建 GitHub Issue**

首先创建一个 Issue，描述可不填，设置 **Note** 标签。创建一条评论会自动触发 GitHub Actions 工作流，等待执行完成后，请查看你的 GitHub Page 主页 `yourname.github.io/all-in-github`（指定了子路径）。

评论内容示例：

```
<!-- tags: blog -->
<!-- title: 文章测试 -->
<!-- description: 文章测试 -->

First blog test
```

### **开启 GitHub Pages**

打开**项目** Settings -> Pages -> Build and deployment，开启 Pages，设置如下：

- Source 选择【Deploy from a branch】
- Branch 选择【gh-pages】，Folder 选择【/(root)】，并保存。

执行上述操作，等待部署 Workflow 执行完成后，打开 https://yourname.github.io/all-in-github 查看你的博客。

## 实现原理

在 GitHub Issues 中，**Note** 和 **Blog** 分别对应两条内容生成流程：Note 将评论转换为独立笔记，Blog 将 Issue 正文及其评论合并为一篇长文章。

当指定动作（比如创建/编辑评论）发生时，将触发 GitHub Workflows：

1. 构建阶段：根据评论生成静态博客内容。
2. 部署阶段：触发 GitHub Pages Workflow，将内容发布上线。

其中，Note 与 Blog 标签在系统中被视为分类（category），但在应用场景和触发时机上有所区别。

具有 Note 标签的 Issues：

- Issue 的每个评论是一篇博客文章，这适合记录代码片段、debug 日志和灵感想法等一些比较琐碎的内容。
- 当**创建或编辑** Issue 评论时会触发 [build-note](https://github.com/byodian/all-in-github/blob/main/.github/workflows/build-note.yml) 的 GitHub Actions 工作流。
- 仅处理仓库所有者的评论；带有 `Blog`、`Publishing` 或 `Published` 标签的 Issue 不会按笔记处理。

具有 Blog 标签的 Issues：

- 每个 Issue 是一篇博客文章，这适合发布一些篇幅较长的博客文章。
- 当为 Issue 打上 **Publishing** 标签时会触发 [build-blog](https://github.com/byodian/all-in-github/blob/main/.github/workflows/build-blog.yml) 的 GitHub Actions 工作流。文章生成后，标签 **Publishing** 会被自动修改为 **Published**。

生成的文章由 Astro 内容集合读取，站点配置集中在 `blog/astro-paper.config.ts`，部署流程将静态页面及全文搜索索引发布到 GitHub Pages。

### 注意事项

具有 Note 标签的 Issues 本质上是一个分类，由于每条评论都是一条博客文章，所以无法使用 issue 标题作为博客标题。

此系统使用 HTML 注释作为标识，[makeNote](https://github.com/byodian/all-in-github/blob/main/actions/src/makeNote.ts) 负责解析。您可以在评论中分别插入博客标题、标签和描述注释，作为 HTML 注释，它们不会在博客中展示：

- 标题：`<!-- title: 博客的文章 -->`
- 标签：`<!-- tags: tag1,tag2 -->` 多个标签使用英文逗号分隔
- 描述：`<!-- description: 博客描述 -->`

## 项目结构

```
.
├── .github
├── actions
│   └── src (内容生成脚本和 Note Editor)
├── blog (AstroPaper 博客)
│   ├── astro-paper.config.ts (站点配置)
│   └── src/content
│       ├── blog (文章)
│       └── pages (About 等独立页面)
├── docs (项目维护文档)
├── LICENSE
├── package.json
└── README.md
```

主仓库存放 GitHub Actions 配置和 Astro blog，此项目使用 [git-subtree](https://manpages.debian.org/testing/git-man/git-subtree.1.en.html) 单独维护 [Astro blog](https://github.com/byodian/astro-paper) Git 项目。

> Astro blog 是一个开源项目，使用 git-subtree 即可以保留来自上游的更新（pull upstream），又可以让 GitHub Actions 操作这个子目录（在 blog 文件夹创建博客文件）。
