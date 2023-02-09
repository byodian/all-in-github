import { Octokit } from '@octokit/core'
import { createOrUpdateTextFile } from '@octokit/plugin-create-or-update-text-file'
import { paginateRest } from '@octokit/plugin-paginate-rest'
// import { ReadmeBox } from "readme-box";

type Issue = {
  [k: string]: unknown;
  title: string;
  htmlUrl: string;
  state: string;
  body?: string | null;
}

const owner = 'byodian'
const repo = 'all-in-github'
const labels = 'onetab'

const MyOctokit = Octokit.plugin(paginateRest, createOrUpdateTextFile).defaults({
  userAgent: 'byodian all-in-github',
})

const octokit = new MyOctokit({
  auth: process.env.GITHUB_TOKEN,
})

run(octokit)

async function run(octokitInstance: typeof octokit) {
  const issues = await octokitInstance.paginate(
    'GET /repos/{owner}/{repo}/issues',
    {
      owner,
      repo,
      labels,
      state: 'all',
      per_page: 100,
    },
  )

  const content = issues
    .map((issue) => {
      return parserOneTabIssue({
        title: issue.title,
        state: issue.state,
        htmlUrl: issue.html_url,
        body: issue.body,
        createdAt: issue.created_at,
      })
    })
    .join('\r\n')

  await octokitInstance.createOrUpdateTextFile({
    owner,
    repo,
    path: 'onetab.md',
    message: 'docs(onetab): Update onetab',
    content,
  })
}

function parserOneTabIssue(issue: Issue) {
  let markdownBody = ''
  const body = issue.body

  if (body) {
    const linkWithNameArray: string[] = body
      .split('\r\n')
      .filter(item => item)

    // convert string to markdown link string
    // https://www.example.com | example -> [example](https://www.example.com)
    markdownBody = linkWithNameArray
      .map((linkWithName) => {
        const [link, name] = linkWithName.split(' | ')
        return `- [${name}](${link})`
      })
      .join('\r\n')
  }

  const markdown = `
## [${issue.title}](${issue.htmlUrl})

created ${issue.createdAt}

${markdownBody}
`
  return markdown
}
