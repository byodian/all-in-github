import { Octokit } from '@octokit/core'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { getDay, getHours, getMonth } from 'date-fns'
import { format, utcToZonedTime } from 'date-fns-tz'
import {
  MORNING_ISSUE_NUMBER,
  OWNER,
  REPO,
  TIME_ZONE_NAME,
} from './config'

type Comments = {
  [k: string]: unknown;
  created_at: string
}[]

const MyOctokit = Octokit.plugin(paginateRest).defaults({
  userAgent: 'byodian all-in-github',
})

const octokit = new MyOctokit({
  auth: process.env.GITHUB_TOKEN,
})

// 判断是否打卡
function getStatusForGetUp(comments: Comments) {
  const now = utcToZonedTime(new Date(), TIME_ZONE_NAME)

  if (!comments.length) return { isCheckIn: false }

  const latestComment = comments.at(-1)
  const latestCommentDate = utcToZonedTime(latestComment!.created_at, TIME_ZONE_NAME)
  const isCheckIn = getDay(now) === getDay(latestCommentDate) && getMonth(now) === getMonth(latestCommentDate)

  return { isCheckIn }
}

function makeGetupMessage() {
  const MESSAGE_TEMPLATE = '今天的起床时间是'

  const now = utcToZonedTime(new Date(), TIME_ZONE_NAME)
  const localDate = format(now, 'yyyy-MM-dd HH:mm:ss')
  const hours = getHours(now)

  // 4- 8 means early for me
  const isEarly = hours >= 3 && hours <= 8
  const message = `${MESSAGE_TEMPLATE}\n${localDate}`

  return { message, isEarly }
}

async function run(octokitInstance: typeof octokit) {
  const comments = await octokitInstance.paginate(
    'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
    {
      owner: OWNER,
      repo: REPO,
      issue_number: MORNING_ISSUE_NUMBER,
    })

  const { isCheckIn } = getStatusForGetUp(comments)

  if (isCheckIn) {
    console.log('You have checked in')
    return
  }
  const { message, isEarly } = makeGetupMessage()

  if (isEarly) {
    await octokitInstance.request(
      'POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner: OWNER,
        repo: REPO,
        issue_number: MORNING_ISSUE_NUMBER,
        body: message,
      },
    )
  }

  else { console.log('You wake up lately') }
}

run(octokit)
