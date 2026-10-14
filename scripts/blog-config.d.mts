export type BlogConfigValidationError = {
  path: string
  message: string
}

type ResolvedThemeConfig = Omit<
  import('../blog/src/types/config').ResolvedAstroPaperConfig,
  'site'
> & {
  site: import('../blog/src/types/config').ResolvedAstroPaperConfig['site'] & {
    base: string
  }
  home: {
    title: string
    description: string
    readmeUrl: string
  }
}

export type ResolvedBlogConfiguration = {
  themeId: 'astro-paper'
  themeOptions: Record<string, Record<string, unknown>>
  deployment: {
    site: string
    base: string
    locales: string[]
    defaultLocale: string
  }
  themeConfig: ResolvedThemeConfig
}

export function validateBlogConfiguration(config: unknown): BlogConfigValidationError[]
export function resolveBlogConfiguration(config: unknown): ResolvedBlogConfiguration
