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
