declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ISSUE_NUMBER: number;
      GITHUB_TOKEN: string;
      COMMENT_ID: number;
    }
  }
}

export {}