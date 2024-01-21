import { Octokit } from '@octokit/core'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { getDay, getHours, getMonth } from 'date-fns'
import { format, utcToZonedTime } from 'date-fns-tz'
import minimist from 'minimist'

import {
  ISSUE_NUMBER,
  OWNER,
  REPO,
  TIME_ZONE_NAME,
} from './config'

const GET_UP_MESSAGE = '今天的起床时间是：'
const WEATHER_MESSAGE = '天气：11˚C and cloudy。 空气指数：75 - Excellent '

const MyOctokit = Octokit.plugin(paginateRest).defaults({
  userAgent: 'byodian all-in-github',
})

const octokit = new MyOctokit({
  auth: process.env.GITHUB_TOKEN,
})

// 判断是否打卡
function getStatusForGetUp(
  comments: {
    created_at: string
  }[],
) {
  const now = utcToZonedTime(new Date(), TIME_ZONE_NAME)

  if (!comments.length) return { isCheckIn: false }

  const latestComment = comments.at(-1)
  const latestCommentDateTime = utcToZonedTime(latestComment!.created_at, TIME_ZONE_NAME)
  const isCheckIn = getDay(now) === getDay(latestCommentDateTime) && getMonth(now) === getMonth(latestCommentDateTime)

  return { isCheckIn }
}

function makeGetupMessage() {
  const now = utcToZonedTime(new Date(), TIME_ZONE_NAME)
  const localDateTime = format(now, 'yyyy-MM-dd HH:mm:ss')
  const hours = getHours(now)

  // 4 - 8 means early for me
  const isEarly = hours >= 4 && hours <= 8
  const message = `${GET_UP_MESSAGE}\n${localDateTime}`

  return { message, isEarly }
}

async function run(weatherMessage: string) {
  console.log('weather-message', weatherMessage)
  const comments = await octokit.paginate(
    'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
    {
      owner: OWNER,
      repo: REPO,
      issue_number: ISSUE_NUMBER.morning,
    })

  const { isCheckIn } = getStatusForGetUp(comments)

  if (isCheckIn) {
    console.log('You have checked in')
    return
  }

  const { message, isEarly } = makeGetupMessage()

  if (isEarly) {
    await octokit.request(
      'POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner: OWNER,
        repo: REPO,
        issue_number: ISSUE_NUMBER.morning,
        body: weatherMessage ? `${message}\n\n${weatherMessage}` : message,
      },
    )
  }

  else {
    console.log('You wake up late or early')
    // test
    console.log(`${message}\n\n${WEATHER_MESSAGE}`)
  }
}

const options = minimist(process.argv.slice(2))

run(options.weatherMessage)
