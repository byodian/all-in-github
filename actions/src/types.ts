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
  id: number,
  tags: string[];
  title: string;
  author: string;
  description?: string;
  ogImage?: string;
  canonicalURL?: string;
  pubDatetime?: Date;
  modDatetime?: Date | null;
  scrollSmooth?: boolean;
}
