import { BLOG_LINKS } from "@/router.config";
import type { APIRoute } from "astro";

const getRobotsTxt = (sitemapURL: URL) => `
User-agent: *
Allow: /

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL(BLOG_LINKS.SITE_MAP, site);
  return new Response(getRobotsTxt(sitemapURL));
};
