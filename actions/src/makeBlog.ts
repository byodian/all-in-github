import path from 'path'
import { Octokit } from '@octokit/core'
import { createOrUpdateTextFile } from '@octokit/plugin-create-or-update-text-file'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { getBacisTemplate } from './utils'
import { Post } from './types'
import { FILE_PATH_PREFIX, OWNER, REPO } from './config'

const MyOctokit = Octokit.plugin(paginateRest, createOrUpdateTextFile).defaults({
  userAgent: 'byodian all-in-github',
})

const octokit = new MyOctokit({
  auth: process.env.GITHUB_TOKEN,
})

const FILTER_TAGS = ['Blog', 'Published', 'Publishing']

main()

async function main() {
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
    .filter(label => !FILTER_TAGS.includes(label))
  const postMeta: Post = {
    tags,
    title,
    slug: String(id),
    author: OWNER,
    pubDatetime: created_at,
    modDatetime: updated_at || null,
    featured: tags.includes('featured'),
  }
  const postContent = body!
  const post = `${getBacisTemplate(postMeta)}\n${postContent}`

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
    path: path.join(FILE_PATH_PREFIX, fileName),
    message: `docs(blog): update ${fileName}`,
    content: commentContent ? `${post}\n\n${commentContent}` : post,
  })

  console.log(commentContent ? post + commentContent : post)

  // 更新 Issue 标签
  await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    labels: ['Blog', 'Published'],
  })
}
