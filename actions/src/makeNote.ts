import path from 'path'
import { Octokit } from '@octokit/core'
import { createOrUpdateTextFile } from '@octokit/plugin-create-or-update-text-file'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import yaml from 'yaml'
import { Note } from './types'
import {
  FILE_DATE_TIME_FORMAT,
  FILE_PATH_PREFIX,
  NOTE_EXCLUDED_TAGS,
  OWNER,
  REPO,
} from './config'
import { extractTagsFromComment, extractTitleFromComment, formatDate, hasIntersection, stripHtmlComments } from './utils'
const { GITHUB_TOKEN, ISSUE_NUMBER, COMMENT_ID } = process.env

const MyOctokit = Octokit.plugin(paginateRest, createOrUpdateTextFile).defaults({
  userAgent: `${OWNER} all-in-github`,
})

const octokit = new MyOctokit({
  auth: GITHUB_TOKEN,
})

run()

async function run() {
  const issue = await octokit.request(
    'GET /repos/{owner}/{repo}/issues/{issue_number}',
    {
      owner: OWNER,
      repo: REPO,
      issue_number: ISSUE_NUMBER,
    },
  )

  const issueTags = issue.data.labels.map(label => typeof label === 'string' ? label : label.name!)
  if (hasIntersection(issueTags, NOTE_EXCLUDED_TAGS)) {
    console.log('Note contains exclude tags, skipped:', issueTags)
    return
  }

  const comment = await octokit.request(
    'GET /repos/{owner}/{repo}/issues/comments/{comment_id}',
    {
      owner: OWNER,
      repo: REPO,
      comment_id: COMMENT_ID,
    },
  )

  const { body, id, created_at, updated_at } = comment.data
  const content = stripHtmlComments(body)
  const commentTags = extractTagsFromComment(body)
  const title = extractTitleFromComment(body) || content.substring(0, 20)
  const tags = [...issueTags, ...commentTags]

  const noteMeta: Note = {
    tags,
    title,
    slug: String(id),
    author: OWNER,
    pubDatetime: created_at,
    modDatetime: updated_at || null,
  }

  const frontMatter = `---\n${yaml.stringify(noteMeta)}---\n${content}`

  // 创建 Markdown 文档
  const groupedTags = tags.join('_').toLocaleLowerCase()
  const fileName = `${formatDate(created_at, FILE_DATE_TIME_FORMAT)}_${title}_${groupedTags}.md`
  await octokit.createOrUpdateTextFile({
    owner: OWNER,
    repo: REPO,
    path: path.join(FILE_PATH_PREFIX, 'blog', fileName),
    message: `docs(${groupedTags}): update ${fileName}`,
    content: frontMatter,
  })

  console.log(frontMatter)
}

