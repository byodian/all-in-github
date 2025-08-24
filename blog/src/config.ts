export const SITE = {
  website: "https://byodian.github.io/", // replace this with your deployed domain
  base: '/all-in-github', // base URL for the site
  author: "byodian",
  profile: "https://byodian.github.io/",
  desc: "A minimal, responsive, Github Actions powered and SEO-friendly Astro blog.",
  title: "All in GitHub",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: true,
    text: "Edit page",
    url: "https://github.com/byodian/all-in-github/edit/main/blog/",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "Asia/Shanghai", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
  siteDescription: 'All in Github 使用 Github Issues 作为博客的内容管理系统，配合 Github Actions 实现自动化的博客生成与部署。',
  siteReadmeLink: 'https://github.com/byodian/all-in-github#readme'
} as const;
