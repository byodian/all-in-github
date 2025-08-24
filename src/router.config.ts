// Normalize the path by removing duplicate slashes
// and add starting slash if missing
function normalizePath(path: string) {
  let normalized = path.replace(/\/+/g, '/');
  
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  
  return normalized;
}

const BASE_URL = import.meta.env.BASE_URL ?? "";
export const BLOG_LINKS = {
  SITE_BASE_URL: BASE_URL,
  TOGGLE_THEME: normalizePath(`${BASE_URL}/toggle-theme.js`),
  POSTS: normalizePath(`${BASE_URL}/posts`),
  TAGS: normalizePath(`${BASE_URL}/tags`),
  ABOUT: normalizePath(`${BASE_URL}/about`),
  ARCHIVES: normalizePath(`${BASE_URL}/archives`),
  SEARCH: normalizePath(`${BASE_URL}/search`),
  SITE_MAP: normalizePath(`${BASE_URL}/sitemap-index.xml`),
  RSS: normalizePath(`${BASE_URL}/rss.xml`),
  FAVICON: normalizePath(`${BASE_URL}/favicon.svg`),
  BREADCRUMB: normalizePath(`${BASE_URL}/breadcrumb`),
  PAGE_FIND: normalizePath(`${BASE_URL}/pagefind/`),
  BLOG_ROOT_DIR: 'src/content/blog',
} as const;