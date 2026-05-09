import { extractDescriptionFromComment, extractTagsFromComment, extractTitleFromComment, stripHtmlComments } from './utils'

export type NoteCommentFields = {
  title: string;
  description: string;
  tags: string[];
  body: string;
}

export function parseNoteComment(body?: string): NoteCommentFields {
  return {
    title: extractTitleFromComment(body),
    description: extractDescriptionFromComment(body),
    tags: extractTagsFromComment(body),
    body: stripHtmlComments(body).trim(),
  }
}

export function composeNoteComment(fields: NoteCommentFields) {
  const metadata = [
    `<!-- title: ${fields.title.trim()} -->`,
    `<!-- tags: ${fields.tags.map(tag => tag.trim()).filter(Boolean).join(',')} -->`,
    `<!-- description: ${fields.description.trim()} -->`,
  ]

  const body = fields.body.trim()
  return body ? `${metadata.join('\n')}\n\n${body}` : metadata.join('\n')
}
