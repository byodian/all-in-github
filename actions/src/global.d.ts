declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ISSUE_NUMBER: number;
      GITHUB_TOKEN: string
    }
  }
}

export {}