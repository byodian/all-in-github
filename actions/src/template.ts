import { Post } from './types'

export function getBacisTemplate(post: Post) {
  return `---
author: ${post.author}
pubDatetime: ${post.pubDatetime}
modDatetime: ${post.modDatetime ? post.modDatetime : null}
title: ${post.title}
slug: ${post.id}
featured: ${post.tags.includes('featured')}
description: ${post.description ? post.description : ''}
tags: ${post.tags}
---
  `
}
