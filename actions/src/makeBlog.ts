import path from 'path'
import { Octokit } from '@octokit/core'
import { createOrUpdateTextFile } from '@octokit/plugin-create-or-update-text-file'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import yaml from 'yaml'
import { Post } from './types'
import {
  BLOG_EXCLUDED_TAGS,
  BLOG_UPDATED_ISSUE_TAGS,
  FILE_PATH_PREFIX,
  OWNER,
  REPO,
} from './config'

const MyOctokit = Octokit.plugin(paginateRest, createOrUpdateTextFile).defaults({
  userAgent: `${OWNER} all-in-github`,
})

const octokit = new MyOctokit({
  auth: process.env.GITHUB_TOKEN,
})

run()

async function run() {
  const issueNumber = process.env.ISSUE_NUMBER
  const issue = await octokit.request(
    'GET /repos/{owner}/{repo}/issues/{issue_number}',
    {
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
    },
  )

  const { id, title, body, labels, comments: commentCount, created_at, updated_at } = issue.data
  const tags = labels
    .map(label => typeof label === 'string' ? label : label.name!)
    .filter(label => !BLOG_EXCLUDED_TAGS.includes(label))
  const postMeta: Post = {
    tags,
    title,
    slug: String(id),
    author: OWNER,
    pubDatetime: created_at,
    modDatetime: updated_at || null,
    featured: tags.includes('featured'),
  }

  const frontMatter = `---\n${yaml.stringify(postMeta)}---\n`
  const postContent = body!
  const post = `${frontMatter}\n${postContent}`

  // 追加评论内容
  let commentContent
  if (commentCount > 0) {
    const comments = await octokit.paginate(
      'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
      {
        owner: OWNER,
        repo: REPO,
        issue_number: process.env.ISSUE_NUMBER,
      },
    )

    commentContent = comments
      .map(comment => comment.body)
      .join('\n')
  }

  // 创建 Markdown 文档
  const fileName = `${title}.md`
  await octokit.createOrUpdateTextFile({
    owner: OWNER,
    repo: REPO,
    // file path: ./blog/src/content/blog/{fileName}
    path: path.join(FILE_PATH_PREFIX, 'blog', fileName),
    message: `docs(blog): update ${fileName}`,
    content: commentContent ? `${post}\n\n${commentContent}` : post,
  })

  console.log(commentContent ? post + commentContent : post)

  // 更新 Issue 标签
  await octokit.request('PUT /repos/{owner}/{repo}/issues/{issue_number}/labels', {
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    labels: BLOG_UPDATED_ISSUE_TAGS.concat(tags),
  })
}
