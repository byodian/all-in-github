import { format, utcToZonedTime } from 'date-fns-tz'
import { DATE_TIME_FORMAT, TIME_ZONE_NAME } from './config'

export function bumpBoopCounter(content: string | null) {
  if (!content) return ''

  return content.replace(
    /<!-- boop-counter -->(\d+)<!-- \/boop-counter -->/,
    (_content, counter) =>
      `<!-- boop-counter -->${Number(counter) + 1}<!-- /boop-counter -->`,
  )
}

export function nodeBase64ToUtf8(content: string) {
  return Buffer.from(content, 'base64').toString()
}

export function nodeUtf8ToBase64(content: string) {
  return Buffer.from(content, 'utf8').toString('base64')
}

export function createRegExp(section: string) {
  const start = `<!--START_SECTION:${section}-->`
  const end = `<!--END_SECTION:${section}-->`
  const regex = new RegExp(`${start}\n(?:(?<content>[\\s\\S]+)\n)?${end}`)
  return { regex, start, end }
}

export function getSection(regex: RegExp, content: string) {
  const match = content.match(regex)
  return match?.groups?.content
}

export function formatDate(datetime: string, formatOptions = DATE_TIME_FORMAT) {
  return format(
    utcToZonedTime(datetime, TIME_ZONE_NAME),
    formatOptions,
  )
}
