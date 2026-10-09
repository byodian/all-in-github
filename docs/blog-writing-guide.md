# Blog 文章排版指南

维护者：BAI YONGJIAN

本文约定通过 Note issue 评论发布文章时的排版方式，适用于当前项目的
AstroPaper 6.1.0。通用语法参考
[AstroPaper v6.1.0 写作指南](https://github.com/satnaing/astro-paper/blob/v6.1.0/src/content/posts/adding-new-post.mdx)，
本项目的生成流程与配置以本文说明为准。

## 发布格式与支持范围

Note 生成器将评论正文写入 `blog/src/content/blog/*.md`，自动补充 frontmatter。
评论正文使用普通 Markdown，不添加 YAML frontmatter、MDX import、JSX 或组件。
上游示例的文章目录是 `src/content/posts`，本项目保留 `src/content/blog`。

站点已启用目录、Shiki 代码增强、Callouts、图片灯箱和 MDX。MDX 能力用于
单独维护的 `.mdx` 文件，不会将 Note 评论转换成 MDX。当前没有配置 Mermaid
或数学公式渲染，图示使用 Markdown 表格、文本图或已有图片。

配置依据：

- [内容集合](../blog/src/content.config.ts)：读取 `.md`、`.mdx`，集合名称为 `posts`。
- [Markdown 配置](../blog/astro.config.ts)：目录、折叠目录、代码增强和 Callouts。
- [站点样式](../blog/src/styles/global.css)：Callouts 使用 Obsidian 主题。
- [Note 生成器](../actions/src/makeNote.ts)：解析元数据并生成 Markdown。

升级主题后，重新核对这些文件和对应版本的上游指南，再使用新增语法。

## 文章结构与发布模板

页面已经显示文章标题，正文从二级标题 `##` 开始。开篇简述问题和结论，随后
按内容组织背景、分析、方案和验证。短文不强制添加目录；长文使用准确的英文
标题 `## Table of contents`，由插件生成并折叠目录。

生成文章保留可见的 AI 内容标识，主题标签追加 `AI-generated`。该标识说明
内容来源，不替代作者字段，也不代表已完成人工审核。

以下模板用于 Note 评论；发布时替换标题、摘要、标签和正文：

```markdown
<!-- title: 文章标题 -->
<!-- tags: 源码分析,主题,AI-generated -->
<!-- description: 一句话摘要 -->

> **AI 生成内容（AI-generated content）**：本文由 AI 生成。

简述问题与主要结论。

## Table of contents

## 背景

说明触发条件和约束。

## 分析与方案

给出关键证据、方案和取舍。

## 验证

记录实际执行的检查和结果，区分已验证事实与待验证事项。
```

元数据值必须非空、单行，标签使用英文逗号分隔。分类由 issue 标签决定。
生成器会移除所有 HTML 注释，代码围栏中的 HTML 注释也会被移除；需要在文章中
展示注释定界符时，将其转义，不能依靠代码围栏保护。

## 表格、列表和引用

使用 GFM 表格比较方案，用有序列表表达步骤，用任务列表记录实际完成情况。
表格避免过多列，单元格只保留用于比较的信息。

```markdown
| 方案   | 适用情况 | 代价         |
| ------ | -------- | ------------ |
| 方案 A | 少量数据 | 操作简单     |
| 方案 B | 批量处理 | 需要额外配置 |

1. 确认输入条件。
2. 执行操作。
3. 检查结果。

- [x] 已完成的检查
- [ ] 待验证的事项

> 补充背景或直接引用的内容。

证据见[来源](https://example.com/source)，也可以使用脚注[^source]。

[^source]: 来源与说明。
```

标题、段落、列表、表格和代码围栏之间留空行。引用注明出处，链接尽量指向
确定版本或提交；源码证据同时说明相关符号和行为。

## Callouts 提示块

Callouts 使用普通 Markdown 引用语法，无需 HTML 或 MDX。按内容选择类型：

| 类型                | 用途             |
| ------------------- | ---------------- |
| `NOTE`、`INFO`      | 补充说明和背景   |
| `TIP`               | 操作建议         |
| `WARNING`、`DANGER` | 风险及可能后果   |
| `SUCCESS`           | 已确认的成功结果 |

标记后可以添加自定义标题。正文各行保留 `>` 前缀；类型后的 `-` 表示默认折叠，
`+` 表示默认展开且可折叠。关键结论和必要提醒保持可见，只折叠补充细节。

```markdown
> [!NOTE] 验证范围
> 本次验证覆盖文章生成与页面访问。

> [!TIP]+ 补充说明
> 此处放可展开或收起的操作细节。

> [!INFO]- 相关背景
> 此处放默认收起的背景资料。

> [!WARNING] 操作提醒
> 此处写需要读者直接看到的风险和后果。
```

## 代码围栏与 Shiki 增强

围栏注明语言，只保留解释所需的代码。文件名使用 `file="src/example.ts"`。
本项目的文件名解析器按空格拆分元数据，所以标注路径不能包含空格。

行高亮、关键词高亮和增删标记放在对应语言的有效注释中：

````markdown
```ts file="src/example.ts"
// [!code word:timeoutMs]
const timeoutMs = 5000;
const retries = 3; // [!code highlight]
```

```ts file="src/request.ts"
const timeoutMs = 3000; // [!code --]
const timeoutMs = 5000; // [!code ++]
```
````

增删示例用于展示修改前后，不作为可直接执行的完整程序。HTML 等语言通常
使用 HTML 注释，但 Note 生成器会移除这些注释；此时使用 `diff` 围栏或块外说明：

````markdown
```diff
- <button>提交</button>
+ <button type="submit">提交</button>
```
````

## 图片与灯箱

使用 `![说明](地址)` 并提供有意义的 alt。图片应使用可公开访问的 HTTPS 地址，
或已经存在于仓库中的图片。以下路径仅为语法示例，使用前确认实际资源存在：

```markdown
![架构示意图](https://example.com/architecture.png)
![源码图片](@/assets/images/example.png)
![相对路径图片](../../assets/images/example.png)
![公共资源](/all-in-github/images/example.png)
```

相对路径以生成的文章文件为基准，子目录中的文章需调整路径。`public/` 中的
图片使用包含站点 base `/all-in-github` 的 URL；本机绝对路径不能用于发布。
文章中未包在链接内的图片支持灯箱放大，不必添加额外脚本。

## 发布前核对

- 元数据完整，正文没有 frontmatter 或重复一级标题。
- AI 标识和标签保留，人工复核及验证描述符合实际情况。
- Callouts、代码注释和文件名标注符合本项目支持的语法。
- 图片与来源可访问，正文不包含凭据、个人数据或本机绝对路径。
- 仅使用目标站点已配置的渲染能力。

Note 评论写入、发布身份检查及回执处理见
[publish-note-blog skill](../.codex/skills/publish-note-blog/SKILL.md)。
