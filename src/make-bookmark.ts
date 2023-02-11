import { Octokit } from '@octokit/core'
import { createOrUpdateTextFile } from '@octokit/plugin-create-or-update-text-file'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { format, utcToZonedTime } from 'date-fns-tz'
import { DATE_TIME_FORMAT, ISSUE_NUMBER, OWNER, REPO, TIME_ZONE_NAME } from './config'
import { IssueComment } from './types'
import { createRegExp, getSection } from './utils'

const MyOctokit = Octokit.plugin(paginateRest, createOrUpdateTextFile).defaults({
  userAgent: 'byodian all-in-github',
})

const octokit = new MyOctokit({
  auth: process.env.GITHUB_TOKEN,
})

function getCommentTitleAndBody(content: string) {
  const { regex: titleReg } = createRegExp('title')
  const { regex: bodyReg } = createRegExp('body')

  const title = getSection(titleReg, content)!

  // 评论主体内容格式
  // 1) http 开头
  // 2) markdown 链接形式

  // https://www.example.com | example -> [example](https://www.example.com)
  const body = getSection(bodyReg, content)!
    .split('\n')
    .map((link) => {
      if (/^http/.test(link)) {
        const [url, name] = link.split(' | ')
        return `- [${name}](${url})`
      }

      return link
    })
    .join('\n')

  return { title, body }
}

function makeMakrdown(option: {
  title: string;
  url: string;
  createdAt: string;
  body: string

}) {
  return `
## [${option.title}](${option.url})

created ${option.createdAt}

${option.body}
`
}

function getCommentCreatedAt(createdAt: string) {
  return format(
    utcToZonedTime(createdAt, TIME_ZONE_NAME),
    DATE_TIME_FORMAT,
  )
}

function parserComments(comment: IssueComment) {
  // '\r\n' -> '\n'
  const content = comment.body
    .split('\r\n')
    .filter(item => item)
    .join('\n')

  const { title, body } = getCommentTitleAndBody(content)
  const createdAt = getCommentCreatedAt(comment.createdAt)

  return makeMakrdown({
    title,
    body,
    createdAt,
    url: comment.htmlUrl,
  })
}

async function run() {
  const comments = await octokit.paginate(
    'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
    {
      owner: OWNER,
      repo: REPO,
      issue_number: ISSUE_NUMBER.bookmark,
    },
  )

  const content = comments
    .map((comment) => {
      return parserComments({
        htmlUrl: comment.html_url,
        body: comment.body!,
        createdAt: comment.created_at,
      })
    })
    .join('\r\n')

  await octokit.createOrUpdateTextFile({
    owner: OWNER,
    repo: REPO,
    path: 'bookmark.md',
    message: 'docs(bookmark): Update bookmark',
    content,
  })
}

run()
