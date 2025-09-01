# All-in-Github

All in Github 使用 Github Issues 作为博客的内容管理系统，配合 Github Actions 实现自动化的博客生成与部署。

## 如何使用

> [!IMPORTANT]
> 请严格按照步骤进行项目设置。

### [Fork](https://github.com/byodian/all-in-github/fork) 项目，开启 Github workflows 和 Isuues

由于复刻的项目 Github workflows 和 Isuues 默认关闭，你需要显示开启它们。

- 打开 Issues：Settings -> General -> Features -> Issues
- 打开 Workflows：Actions -> I understand my workflows, go ahead and enable them

### 项目配置

修改 Github actions 配置，文件位置 [actios/src/config.ts](./actions/src/config.ts)

```ts
// GitHub 仓库信息
export const OWNER = 'byodian' // 替换为你的 Github 账号名称
export const REPO = 'all-in-github' // 替换为你的仓库名称
```
修改博客配置，文件位置：[blog/src/config.ts](./blog/src/config.ts)

```ts
export const SITE = {
  website: "https://byodian.github.io/", // 替换成你的 Github 主页
  base: '/all-in-github', // 指定 Github 主页子路径，默认根目录 /
  author: "byodian",
  profile: "https://byodian.github.io/",
  desc: "A minimal, responsive, Github Actions powered and SEO-friendly Astro blog.",
  title: "All in GitHub",
  //...
  editPost: {
      enabled: true,
      text: "Edit page",
      url: "https://github.com/byodian/all-in-github/edit/main/blog/",
  }
  //...
} as const;
```

修改社交媒体链接，文件位置 [blog/src/constants.ts](./blog/src/constants.ts)

### 开启 Github Pages

Settings -> Pages -> Build and deployment

1. Source 选择【Deploy from a branch】
2. Branch 选择【gh-pages】，Folder 选择【/(root)】，并保存。

### 创建 PAT
Personal access tokens(简称PAT) 用于构建阶段——根据评论生成静态博客内容，并触发部署 Github Page Workflow。

Settings -> Developer Settings -> Personal access tokens -> Fine-grained tokens

[TODO]


### 创建 Github 标签

创建 Issues 标签（labels）：**Note**、**Blog**、**Publishing**

### 创建 Github Issue
首先创建一个 Issue，描述可不填，设置 **Note** 标签。创建一条评论会自动触发 Github workflows，等待执行完成后，请查看你的 Github Page 主页 `yourname.github.io/all-in-github`（指定了子路径）。

评论内容示例：

```
<!-- tags: blog -->
<!-- title: 文章测试 -->
<!-- description: 文章测试 -->

First blog test
```

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
具有 Note 标签的 Issues 本质上是一个分类，由于每条评论都是一条博客文章，就无法使用 issue 标题作为博客标题。我们可以在评论中插入下述内容，[makeNote](https://github.com/byodian/all-in-github/blob/bf45661fa34c5682458bd0706c386711f737fe52/actions/src/makeNote.ts#L55-L56) 会将其解析为博客的标题和标签，作为 HTML 注释，它们不会在博客中展示：

```html
<!-- title: 博客的文章 -->
<!-- tags: tag1,tag2 -->
```

## 项目结构

```
.
├── .github
├── actions
├── blog (astro blog)
├── LICENSE
├── package.json
└── README.md
```

主仓库存放 GitHub Actions 配置和 Astro blog。Astro blog 是一个开源项目，为了保留来自上游的更新（pull upstream），同时 Actions 要能操作这个子目录（生成文章文件），项目使用 [git-subtree](https://manpages.debian.org/testing/git-man/git-subtree.1.en.html) 管理 astro blog 模版，意味着此 [blog](https://github.com/byodian/astro-paper) 模版可以作为单独的 Git 项目。

### git subtree
语法：

```bash
git subtree add --prefix=子文件夹名称 <子仓库地址> <分支> --squash
```
`--squash`: 把子仓库的 commit 压缩成一个 commit

常用命令解释：
- git subtree add - 在父仓库中建立一个子目录，把远程仓库的内容拉到里面，并作为父仓库的 commit 管理
- git subtree pull - 拉取子仓库更新


#### 添加子仓库为 subtree

创建子文件夹 blog，并拉取远程仓库作为 blog 的内容，同时在父仓库生成一次新的 commit。

```bash
git subtree add --prefix=blog git@github.com:byodian/astro-paper.git dev --squash
```

#### 更新 subtree

当子仓库有新版本时，拉取最新内容：

```bash
git subtree pull --prefix=blog git@github.com:byodian/astro-paper.git dev --squash
```