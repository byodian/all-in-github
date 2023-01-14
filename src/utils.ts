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
