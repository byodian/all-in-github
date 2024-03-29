export type Issue = {
  title: string;
  htmlUrl: string;
  state: string;
  body?: string | null;
  createdAt: string
}

export type IssueComment = {
  htmlUrl: string;
  createdAt: string;
  body: string;
}

export interface Post {
  slug: string,
  tags: string[];
  title: string;
  author: string;
  description?: string;
  ogImage?: string;
  canonicalURL?: string;
  pubDatetime?: string | Date;
  modDatetime?: string | Date | null;
  scrollSmooth?: boolean;
  featured: boolean;
}

export interface Note {
  slug: string;
  tags: string[];
  title: string;
  author: string;
  description?: string;
  ogImage?: string;
  canonicalURL?: string;
  pubDatetime?: string | Date;
  modDatetime?: string | Date | null;
}
