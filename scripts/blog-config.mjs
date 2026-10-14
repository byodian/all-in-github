const supportedThemes = new Set(['astro-paper'])
const themeOptionNamespaces = new Set(['astro-paper', 'astro-cactus'])
const rootKeys = ['schemaVersion', 'theme', 'site', 'home', 'posts', 'features', 'socials', 'shareLinks']

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateKeys(value, allowedKeys, path, errors) {
  if (!isRecord(value)) return
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) errors.push({ path: `${path}.${key}`, message: 'is not supported' })
  }
}

function validateString(value, path, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push({ path, message: 'must be a non-empty string' })
    return false
  }
  if (value !== value.trim()) errors.push({ path, message: 'must not have leading or trailing whitespace' })
  return true
}

function validateWebUrl(value, path, errors, canonical = false) {
  if (!validateString(value, path, errors)) return
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      errors.push({ path, message: 'must be an absolute HTTP(S) URL without credentials' })
    }
    if (canonical && (url.search || url.hash || /[?#]/.test(value))) {
      errors.push({ path, message: 'must not include a query or fragment' })
    }
  } catch {
    errors.push({ path, message: 'must be an absolute HTTP(S) URL' })
  }
}

function validateLinkUrl(value, path, errors) {
  if (!validateString(value, path, errors)) return
  try {
    const url = new URL(value)
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol) || url.username || url.password) {
      errors.push({ path, message: 'must be an absolute HTTP(S) or mailto URL' })
    }
  } catch {
    errors.push({ path, message: 'must be an absolute HTTP(S) or mailto URL' })
  }
}

function validateLinks(value, path, errors) {
  if (!Array.isArray(value)) {
    errors.push({ path, message: 'must be an array' })
    return
  }
  value.forEach((link, index) => {
    const linkPath = `${path}[${index}]`
    if (!isRecord(link)) {
      errors.push({ path: linkPath, message: 'must be an object' })
      return
    }
    validateKeys(link, ['name', 'url', 'linkTitle'], linkPath, errors)
    if (validateString(link.name, `${linkPath}.name`, errors) && !/^[a-z0-9][a-z0-9-]*$/.test(link.name)) {
      errors.push({ path: `${linkPath}.name`, message: 'must be a lowercase icon name' })
    }
    validateLinkUrl(link.url, `${linkPath}.url`, errors)
    if (Object.hasOwn(link, 'linkTitle')) validateString(link.linkTitle, `${linkPath}.linkTitle`, errors)
  })
}

export function validateBlogConfiguration(config) {
  const errors = []
  if (!isRecord(config)) return [{ path: '$', message: 'must be an object' }]

  validateKeys(config, rootKeys, '$', errors)
  if (config.schemaVersion !== 1) errors.push({ path: 'schemaVersion', message: 'must equal the supported version 1' })

  if (!isRecord(config.theme)) {
    errors.push({ path: 'theme', message: 'must be an object' })
  } else {
    validateKeys(config.theme, ['id', 'options'], 'theme', errors)
    if (!supportedThemes.has(config.theme.id)) {
      errors.push({ path: 'theme.id', message: `must be one of: ${[...supportedThemes].join(', ')}` })
    }
    if (!isRecord(config.theme.options)) {
      errors.push({ path: 'theme.options', message: 'must be an object' })
    } else {
      for (const [themeId, options] of Object.entries(config.theme.options)) {
        if (!themeOptionNamespaces.has(themeId)) {
          errors.push({ path: `theme.options.${themeId}`, message: 'is not a supported theme namespace' })
        }
        if (!isRecord(options)) {
          errors.push({ path: `theme.options.${themeId}`, message: 'must be an object' })
        } else if (themeId === 'astro-paper' && Object.keys(options).length) {
          errors.push({ path: 'theme.options.astro-paper', message: 'has unsupported settings for this theme version' })
        }
      }
      if (supportedThemes.has(config.theme.id) && !Object.hasOwn(config.theme.options, config.theme.id)) {
        errors.push({ path: `theme.options.${config.theme.id}`, message: 'must be present for the active theme' })
      }
    }
  }

  if (!isRecord(config.site)) {
    errors.push({ path: 'site', message: 'must be an object' })
  } else {
    validateKeys(
      config.site,
      ['url', 'title', 'description', 'author', 'profile', 'ogImage', 'lang', 'timezone', 'dir', 'googleVerification'],
      'site',
      errors,
    )
    validateWebUrl(config.site.url, 'site.url', errors, true)
    for (const key of ['title', 'description', 'author', 'ogImage', 'lang', 'timezone', 'dir']) {
      validateString(config.site[key], `site.${key}`, errors)
    }
    if (Object.hasOwn(config.site, 'profile')) validateWebUrl(config.site.profile, 'site.profile', errors)
    if (Object.hasOwn(config.site, 'googleVerification')) {
      validateString(config.site.googleVerification, 'site.googleVerification', errors)
    }
    if (typeof config.site.lang === 'string' && config.site.lang.trim()) {
      try {
        Intl.getCanonicalLocales(config.site.lang)
      } catch {
        errors.push({ path: 'site.lang', message: 'must be a valid BCP 47 language tag' })
      }
    }
    if (typeof config.site.timezone === 'string' && config.site.timezone.trim()) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: config.site.timezone })
      } catch {
        errors.push({ path: 'site.timezone', message: 'must be a valid IANA time zone' })
      }
    }
    if (!['ltr', 'rtl', 'auto'].includes(config.site.dir)) {
      errors.push({ path: 'site.dir', message: 'must be ltr, rtl, or auto' })
    }
  }

  if (!isRecord(config.home)) {
    errors.push({ path: 'home', message: 'must be an object' })
  } else {
    validateKeys(config.home, ['title', 'description', 'readmeUrl'], 'home', errors)
    validateString(config.home.title, 'home.title', errors)
    validateString(config.home.description, 'home.description', errors)
    validateWebUrl(config.home.readmeUrl, 'home.readmeUrl', errors)
  }

  if (!isRecord(config.posts)) {
    errors.push({ path: 'posts', message: 'must be an object' })
  } else {
    validateKeys(config.posts, ['perPage', 'perIndex', 'scheduledPostMargin'], 'posts', errors)
    for (const key of ['perPage', 'perIndex']) {
      if (!Number.isInteger(config.posts[key]) || config.posts[key] < 1) {
        errors.push({ path: `posts.${key}`, message: 'must be a positive integer' })
      }
    }
    if (!Number.isInteger(config.posts.scheduledPostMargin) || config.posts.scheduledPostMargin < 0) {
      errors.push({ path: 'posts.scheduledPostMargin', message: 'must be a non-negative integer in milliseconds' })
    }
  }

  if (!isRecord(config.features)) {
    errors.push({ path: 'features', message: 'must be an object' })
  } else {
    validateKeys(
      config.features,
      ['lightAndDarkMode', 'dynamicOgImage', 'showArchives', 'showBackButton', 'editPost', 'search'],
      'features',
      errors,
    )
    for (const key of ['lightAndDarkMode', 'dynamicOgImage', 'showArchives', 'showBackButton']) {
      if (typeof config.features[key] !== 'boolean') errors.push({ path: `features.${key}`, message: 'must be a boolean' })
    }
    if (!isRecord(config.features.editPost)) {
      errors.push({ path: 'features.editPost', message: 'must be an object' })
    } else if (config.features.editPost.enabled === false) {
      validateKeys(config.features.editPost, ['enabled'], 'features.editPost', errors)
    } else if (config.features.editPost.enabled === true) {
      validateKeys(config.features.editPost, ['enabled', 'url'], 'features.editPost', errors)
      validateWebUrl(config.features.editPost.url, 'features.editPost.url', errors)
    } else {
      errors.push({ path: 'features.editPost.enabled', message: 'must be a boolean' })
    }
    if (config.features.search !== 'pagefind' && config.features.search !== false) {
      errors.push({ path: 'features.search', message: 'must be pagefind or false' })
    }
  }

  validateLinks(config.socials, 'socials', errors)
  validateLinks(config.shareLinks, 'shareLinks', errors)
  return errors
}

export function resolveBlogConfiguration(config) {
  const errors = validateBlogConfiguration(config)
  if (errors.length) {
    throw new Error(errors.map(error => `${error.path}: ${error.message}`).join('\n'))
  }

  const canonicalSiteUrl = new URL(config.site.url)
  const locale = Intl.getCanonicalLocales(config.site.lang)[0]
  const base = canonicalSiteUrl.pathname.replace(/\/+$/, '') || '/'

  return {
    themeId: config.theme.id,
    themeOptions: structuredClone(config.theme.options),
    deployment: {
      site: canonicalSiteUrl.origin,
      base,
      locales: [locale],
      defaultLocale: locale,
    },
    themeConfig: {
      site: { ...config.site, lang: locale, base },
      home: { ...config.home },
      posts: { ...config.posts },
      features: { ...config.features, editPost: { ...config.features.editPost } },
      socials: config.socials.map(link => ({ ...link })),
      shareLinks: config.shareLinks.map(link => ({ ...link })),
    },
  }
}
