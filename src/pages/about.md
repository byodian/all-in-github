---
layout: ../layouts/AboutLayout.astro
title: "About"
---

All in Github 使用 Github Issues 作为博客的内容管理系统，配合 Github Actions 实现自动化的博客生成与部署。

## 原理
Github Issues 中需要两个重要的标签 **Note** 和 **Blog**，带有这些标签的 Issues 评论会作为博客的内容，配合指定动作开始触发 Github workflows 生成静态博客内容，内容创建完成后就会自动部署到 Github Pages。这两个标签在系统中作为分类（category）存在，在适用场景和触发动作上有如下区别：

具有 Note 标签的 Issues：
- Issue 的每个评论是一篇博客文章，这适合记录代码片段、debug 日志和灵感想法等一些比较琐碎的内容。
- 当**创建或编辑** Issue 评论时会触发 [build-note](https://github.com/byodian/all-in-github/blob/main/.github/workflows/build-note.yml) 的 Github workflow。

具有 Blog 标签的 Issues：
- 每个 Issue 是一篇博客文章，这适合发布一些篇幅较长的博客文章。
- 当为 Issue 打上 **Publishing** 标签时会触发 [build-blog](https://github.com/byodian/all-in-github/blob/main/.github/workflows/build-blog.yml) 的 Github workflow。发布完成后，标签 **Publishing** 会被自动修改为 **Published**。

静态站点使用开源 Astro 博客模版 [AstroPaper](https://github.com/satnaing/astro-paper) 作为基础，我们进行了一些修改使其适合部署到 Github Pages。

> AstroPaper is a minimal, accessible and SEO-friendly blog theme built with [Astro](https://astro.build/) and [Tailwind CSS](https://tailwindcss.com/).

## 注意事项
具有 Note 标签的 Issues 本质上是一个分类，由于每条评论都是一条博客文章，就无法使用 issue 标题作为博客标题。我们可以在评论中插入下述内容，[makeNote](https://github.com/byodian/all-in-github/blob/bf45661fa34c5682458bd0706c386711f737fe52/actions/src/makeNote.ts#L55-L56) 会将其解析为博客的标题和标签，作为 HTML 注释，它们不会在博客中展示：

```html
<!-- title: 博客的文章 -->
<!-- tags: tag1,tag2 -->
```