import path from 'path'
import { Octokit } from '@octokit/core'
import { createOrUpdateTextFile } from '@octokit/plugin-create-or-update-text-file'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import yaml from 'yaml'
import { Note } from './types'
import {
  FILE_DATE_TIME_FORMAT,
  FILE_PATH_PREFIX,
  NOTE_EXCLUDED_TAG,
  OWNER,
  REPO,
} from './config'
import { formatDate } from './utils'

const MyOctokit = Octokit.plugin(paginateRest, createOrUpdateTextFile).defaults({
  userAgent: `${OWNER} all-in-github`,
})

const octokit = new MyOctokit({
  auth: process.env.GITHUB_TOKEN,
})

run()

async function run() {
  const issue = await octokit.request(
    'GET /repos/{owner}/{repo}/issues/{issue_number}',
    {
      owner: OWNER,
      repo: REPO,
      issue_number: process.env.ISSUE_NUMBER,
    },
  )

  const tags = issue.data.labels
    .map(label => typeof label === 'string' ? label : label.name!)

  const comment = await octokit.request(
    'GET /repos/{owner}/{repo}/issues/comments/{comment_id}',
    {
      owner: OWNER,
      repo: REPO,
      comment_id: process.env.COMMENT_ID,
    },
  )

  const { body, id, created_at, updated_at } = comment.data

  const noteMeta: Note = {
    tags,
    title: `${body!.substring(0, 20)}...`,
    slug: String(id),
    author: OWNER,
    pubDatetime: created_at,
    modDatetime: updated_at || null,
  }

  const frontMatter = `---\n${yaml.stringify(noteMeta)}---\n${body}`

  // 创建 Markdown 文档
  const filteredTags = tags.filter(tag => tag !== NOTE_EXCLUDED_TAG)
  const tag = (filteredTags.length === 1 ? filteredTags[0] : NOTE_EXCLUDED_TAG).toLocaleLowerCase()
  const fileName = `${formatDate(created_at, FILE_DATE_TIME_FORMAT)}_${tag}.md`
  await octokit.createOrUpdateTextFile({
    owner: OWNER,
    repo: REPO,
    path: path.join(FILE_PATH_PREFIX, 'blog', fileName),
    message: `docs(${tag}): update ${fileName}`,
    content: frontMatter,
  })

  console.log(frontMatter)
}
