---
layout: ../layouts/AboutLayout.astro
title: "About"
---

All in Github 使用 Github Issues 作为博客的内容管理系统，配合 Github Actions 实现自动化的博客生成与部署。

## 如何使用

> [!IMPORTANT]
> 请严格按照步骤进行项目设置。

###  **[Fork](https://github.com/byodian/all-in-github/fork) 项目**

在复刻的项目中，Github workflows 和 Isuues 默认关闭，您需要显示开启它们。

- 打开 Issues：Settings -> General -> Features -> Issues
- 打开 Workflows：Actions -> I understand my workflows, go ahead and enable them

### **项目配置**

- 修改 Github actions 配置，文件位置 [actios/src/config.ts](./actions/src/config.ts)

    ```ts
    // GitHub 仓库信息
    export const OWNER = 'byodian' // 替换为你的 Github 账号名称
    export const REPO = 'all-in-github' // 替换为你的仓库名称
    ```
- 修改博客配置，文件位置：[blog/src/config.ts](./blog/src/config.ts)

    ```ts
    export const SITE = {
        website: "https://byodian.github.io/", // 替换成你的 Github Pages 主页
        base: '/all-in-github', // 指定 Github Pages 子路径
        author: "byodian", // 替换成你的名字
        profile: "https://byodian.github.io/", // 替换成你的网站主页
        desc: "A minimal, responsive, Github Actions powered and SEO-friendly Astro blog.",
        title: "All in GitHub",
        //...
        editPost: {
            enabled: true,
            text: "Edit page",
            url: "https://github.com/byodian/all-in-github/edit/main/blog/", // 将 byodian 换成你的 Github 账号名称
        }
        //...
    } as const;
    ```

- 修改社交媒体链接，文件位置 [blog/src/constants.ts](./blog/src/constants.ts)

### **创建 PAT**

Personal access tokens（简称 PAT），用于在构建阶段，根据评论生成静态博客内容并提交到主分支时，触发部署 Github Page Workflow。

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

### **创建 Github 标签**

创建 Issues 标签（labels）：**Note**、**Blog**、**Publishing**

### **创建 Github Issue**

首先创建一个 Issue，描述可不填，设置 **Note** 标签。创建一条评论会自动触发 Github workflows，等待执行完成后，请查看你的 Github Page 主页 `yourname.github.io/all-in-github`（指定了子路径）。

评论内容示例：

```
<!-- tags: blog -->
<!-- title: 文章测试 -->
<!-- description: 文章测试 -->

First blog test
```

### **开启 Github Pages**

打开**项目** Settings -> Pages -> Build and deployment，开启 Pages，设置如下：

- Source 选择【Deploy from a branch】
- Branch 选择【gh-pages】，Folder 选择【/(root)】，并保存。

执行上述操作，等待部署 Workflow 执行完成后，打开 https://yourname.github.io/all-in-github 查看你的博客。

## 实现原理
在 Github Issues 中，系统依赖两个关键标签：**Note** 和 **Blog**。
凡是带有这两个标签的 Issue 评论都会被收集并生成对应的博客内容。

当指定动作（比如创建/编辑评论）发生时，将触发 Github Workflows：

1. 构建阶段：根据评论生成静态博客内容。
2. 部署阶段：触发 Github Pages Workflow，将内容发布上线。

其中，Note 与 Blog 标签在系统中被视为分类（category），但在应用场景和触发时机上有所区别。

具有 Note 标签的 Issues：
- Issue 的每个评论是一篇博客文章，这适合记录代码片段、debug 日志和灵感想法等一些比较琐碎的内容。
- 当**创建或编辑** Issue 评论时会触发 [build-note](https://github.com/byodian/all-in-github/blob/main/.github/workflows/build-note.yml) 的 Github workflow。

具有 Blog 标签的 Issues：
- 每个 Issue 是一篇博客文章，这适合发布一些篇幅较长的博客文章。
- 当为 Issue 打上 **Publishing** 标签时会触发 [build-blog](https://github.com/byodian/all-in-github/blob/main/.github/workflows/build-blog.yml) 的 Github workflow。发布完成后，标签 **Publishing** 会被自动修改为 **Published**。

静态站点使用开源 Astro 博客模版 [AstroPaper](https://github.com/satnaing/astro-paper) 作为基础，我们进行了一些修改使其适合部署到 Github Pages。

> AstroPaper is a minimal, accessible and SEO-friendly blog theme built with [Astro](https://astro.build/) and [Tailwind CSS](https://tailwindcss.com/).

### 注意事项
具有 Note 标签的 Issues 本质上是一个分类，由于每条评论都是一条博客文章，所以无法使用 issue 标题作为博客标题。

此系统使用 HTML 注释作为标识，[makeNote](https://github.com/byodian/all-in-github/blob/bf45661fa34c5682458bd0706c386711f737fe52/actions/src/makeNote.ts#L55-L56) 负责解析。您可以在评论中分别插入博客标题、标签和描述注释，作为 HTML 注释，它们不会在博客中展示：

- 标题：`<!-- title: 博客的文章 -->`
- 标签：`<!-- tags: tag1,tag2 -->` 多个标签使用英文逗号分隔
- 描述：`<!-- description: 博客描述 -->`

## 项目结构

```
.
├── .github
├── actions
├── blog (Astro blog)
├── LICENSE
├── package.json
└── README.md
```

主仓库存放 GitHub Actions 配置和 Astro blog，此项目使用 [git-subtree](https://manpages.debian.org/testing/git-man/git-subtree.1.en.html) 单独维护 [Astro blog](https://github.com/byodian/astro-paper) Git 项目。

> Astro blog 是一个开源项目，使用 git-subtree 即可以保留来自上游的更新（pull upstream），又可以让 Github Actions 操作这个子目录（在 blog 文件夹创建博客文件）。