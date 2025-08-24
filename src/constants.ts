import type { Props } from "astro";
import IconMail from "@/assets/icons/IconMail.svg";
import IconGitHub from "@/assets/icons/IconGitHub.svg";
import IconBrandX from "@/assets/icons/IconBrandX.svg";
import IconLinkedin from "@/assets/icons/IconLinkedin.svg";
import IconWhatsapp from "@/assets/icons/IconWhatsapp.svg";
import IconFacebook from "@/assets/icons/IconFacebook.svg";
import IconTelegram from "@/assets/icons/IconTelegram.svg";
import IconPinterest from "@/assets/icons/IconPinterest.svg";
import { SITE } from "@/config";

interface Social {
  name: string;
  href: string;
  linkTitle: string;
  icon: (_props: Props) => Element;
}

export const SOCIALS: Social[] = [
  {
    name: "GitHub",
    href: "https://github.com/byodian/all-in-github",
    linkTitle: `${SITE.title} on GitHub`,
    icon: IconGitHub,
  },
  {
    name: "X",
    href: "https://x.com/username",
    linkTitle: `${SITE.title} on X`,
    icon: IconBrandX,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/username/",
    linkTitle: `${SITE.title} on LinkedIn`,
    icon: IconLinkedin,
  },
  {
    name: "Mail",
    href: "mailto:yourmail@gmail.com",
    linkTitle: `Send an email to ${SITE.title}`,
    icon: IconMail,
  },
] as const;

export const SHARE_LINKS: Social[] = [
  {
    name: "WhatsApp",
    href: "https://wa.me/?text=",
    linkTitle: `Share this post via WhatsApp`,
    icon: IconWhatsapp,
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/sharer.php?u=",
    linkTitle: `Share this post on Facebook`,
    icon: IconFacebook,
  },
  {
    name: "X",
    href: "https://x.com/intent/post?url=",
    linkTitle: `Share this post on X`,
    icon: IconBrandX,
  },
  {
    name: "Telegram",
    href: "https://t.me/share/url?url=",
    linkTitle: `Share this post via Telegram`,
    icon: IconTelegram,
  },
  {
    name: "Pinterest",
    href: "https://pinterest.com/pin/create/button/?url=",
    linkTitle: `Share this post on Pinterest`,
    icon: IconPinterest,
  },
  {
    name: "Mail",
    href: "mailto:?subject=See%20this%20post&body=",
    linkTitle: `Share this post via email`,
    icon: IconMail,
  },
] as const;

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
  BLOG_PATH: 'src/content/blog',
};