import { Octokit } from '@octokit/core'
import { createOrUpdateTextFile } from '@octokit/plugin-create-or-update-text-file'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { OWNER, REPO } from './config'

const MyOctokit = Octokit.plugin(paginateRest, createOrUpdateTextFile).defaults({
  userAgent: 'byodian all-in-github',
})

const octokit = new MyOctokit({
  auth: process.env.GITHUB_TOKEN,
})

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

  const data = issue.data
  const title = data.title
  const issueBody = data.body!
  const labels = data.labels
  const commentCount = data.comments
  let commentContent

  // 追加评论内容
  if (commentCount > 0) {
    const comments = await octokit.paginate(
      'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
      {
        owner: OWNER,
        repo: REPO,
        issue_number: process.env.ISSUE_NUMBER,
      },
    )

    const commentBody = comments
      .map(comment => comment.body)
      .join('\r\n')

    commentContent = `## 评论${commentBody}`
  }

  // 创建 Markdown 文档
  await octokit.createOrUpdateTextFile({
    owner: OWNER,
    repo: REPO,
    path: `${title}.md`,
    message: `docs(blog): update ${title}.md`,
    content: commentContent ? issueBody + commentContent : issueBody,
  })

  // 更新 Issue 标签
  await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    labels: ['Blog', 'Published'],
  })
}
