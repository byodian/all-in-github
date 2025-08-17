import { format, utcToZonedTime } from 'date-fns-tz'
import { DATE_TIME_FORMAT, TIME_ZONE_NAME } from './config'

export function bumpBoopCounter(content: string | null) {
  if (!content) { return '' }

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

/**
 * 判断两个列表是否有交集
 */
export function hasIntersection(listA: string[], listB: string[]) {
  if (!Array.isArray(listA) || !Array.isArray(listB)) { return false }
  const isShorter = listA.length < listB.length
  const shortList = isShorter ? listA : listB
  const longList = isShorter ? listB : listA

  const setLong = new Set(longList)
  for (const item of shortList) {
    if (setLong.has(item)) { return true }
  }
  return false
}

/**
 * 从github issue评论中拉取标签列表
 * 标签语法：<!-- tags: java, Spring Boot-->
 * @param commentBody
 * @returns
 */
export function extractTagsFromComment(commentBody?: string) {
  if (!commentBody) {
    return []
  }

  // 匹配 <!-- tags: ... -->
  const regex = /<!--\s*tags:\s*([\s\S]*?)-->/i
  const match = commentBody.match(regex)
  if (!match) {
    return []
  }

  // 提取内容，支持逗号分隔或多行
  const raw = match[1].trim()

  // 兼容多行 YAML/列表风格
  if (raw.includes('\n')) {
    return raw.split('\n')
      .map(l => l.replace(/[-\s]/g, '').trim())
      .filter(Boolean)
  }

  // 单行逗号分隔
  return raw.split(',')
    .map(l => l.trim())
    .filter(Boolean)
}

/**
 * 从github issue评论中拉取标签列表
 * 标签语法：<!-- title: This is title -->
 * @param commentBody
 * @returns
 */
export function extractTitleFromComment(commentBody?: string) {
  if (!commentBody) {
    return ''
  }

  // 匹配 <!-- title: ... -->
  const regex = /<!--\s*title:\s*([\s\S]*?)-->/i
  const match = commentBody.match(regex)
  if (!match) {
    return ''
  }

  return match[1].trim()
}

/**
 * 剔除HTML注释
 * @param markdown
 * @returns
 */
export function stripHtmlComments(markdown: string | undefined) {
  if (!markdown) {
    return ''
  }
  return markdown.replace(/<!--[\s\S]*?-->/g, '')
}
