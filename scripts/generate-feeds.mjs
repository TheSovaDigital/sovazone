import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SITE_URL = "https://sovazone.com";

const FEEDS = [
  {
    code: "ru",
    language: "ru",
    basePath: "",
    blogDir: path.join(ROOT, "content", "blog"),
    articlesDir: path.join(ROOT, "articles"),
    outputs: {
      all: path.join(ROOT, "feed.xml"),
      allAlias: path.join(ROOT, "rss.xml"),
      blog: path.join(ROOT, "blog-feed.xml"),
      articles: path.join(ROOT, "articles-feed.xml")
    },
    titles: {
      all: "SovaZone — статьи и блог",
      blog: "SovaZone — блог",
      articles: "SovaZone — статьи"
    },
    descriptions: {
      all: "RSS-лента SovaZone: блог, статьи о никнеймах, digital identity, социальных сетях, безопасности аккаунтов и верификации.",
      blog: "RSS-лента блога SovaZone: новости, статьи и публикации о digital identity, аккаунтах и социальных сетях.",
      articles: "RSS-лента статей SovaZone: материалы о никнеймах, username, безопасности аккаунтов, верификации и digital identity."
    },
    links: {
      all: `${SITE_URL}/blog`,
      blog: `${SITE_URL}/blog`,
      articles: `${SITE_URL}/articles`
    },
    defaults: {
      blogTitle: "Публикация SovaZone",
      articleTitle: "Статья SovaZone",
      category: "Статьи",
      author: "SovaZone",
      articleAuthor: "SovaZone Digital Studio",
      articleDate: "2026-04-03"
    }
  },
  {
    code: "en",
    language: "en",
    basePath: "/en",
    blogDir: path.join(ROOT, "en", "content", "blog"),
    articlesDir: path.join(ROOT, "en", "articles"),
    outputs: {
      all: path.join(ROOT, "en", "feed.xml"),
      allAlias: path.join(ROOT, "en", "rss.xml"),
      blog: path.join(ROOT, "en", "blog-feed.xml"),
      articles: path.join(ROOT, "en", "articles-feed.xml")
    },
    titles: {
      all: "SovaZone — articles and blog",
      blog: "SovaZone — blog",
      articles: "SovaZone — articles"
    },
    descriptions: {
      all: "SovaZone RSS feed: blog posts and articles about usernames, digital identity, social platforms, account security, and verification.",
      blog: "SovaZone blog RSS feed: posts, updates, and articles about digital identity, accounts, and social platforms.",
      articles: "SovaZone articles RSS feed: evergreen materials about usernames, account security, verification, and digital identity."
    },
    links: {
      all: `${SITE_URL}/en/blog`,
      blog: `${SITE_URL}/en/blog`,
      articles: `${SITE_URL}/en/articles`
    },
    defaults: {
      blogTitle: "SovaZone post",
      articleTitle: "SovaZone article",
      category: "Articles",
      author: "SovaZone",
      articleAuthor: "SovaZone Digital Studio",
      articleDate: "2026-04-03"
    }
  }
];

function stripMatchingQuotes(value) {
  if (!value) return value;
  const first = value[0];
  const last = value[value.length - 1];
  const isQuoted = (first === '"' && last === '"') || (first === "'" && last === "'");
  return isQuoted ? value.slice(1, -1) : value;
}

function cleanInlineValue(value) {
  return stripMatchingQuotes(String(value || "").trim());
}

function foldBlockValue(lines, mode) {
  return lines
    .map((line) => line.replace(/\r/g, ""))
    .map((line) => line.replace(/^\s+/, ""))
    .join(mode === "|" ? "\n" : " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const frontmatter = match[1].replace(/\r/g, "");
  const lines = frontmatter.split("\n");
  const meta = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      i += 1;
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      i += 1;
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    if (!key) {
      i += 1;
      continue;
    }

    if (value === ">" || value === "|") {
      const mode = value;
      const blockLines = [];
      i += 1;

      while (i < lines.length) {
        const nextLine = lines[i];
        const nextTrimmed = nextLine.trim();

        if (!nextTrimmed) {
          blockLines.push("");
          i += 1;
          continue;
        }

        const isIndented = /^\s+/.test(nextLine);
        if (!isIndented) break;

        blockLines.push(nextLine);
        i += 1;
      }

      meta[key] = foldBlockValue(blockLines, mode);
      continue;
    }

    if ((value.startsWith('"') && !value.endsWith('"')) || (value.startsWith("'") && !value.endsWith("'"))) {
      const quote = value[0];
      const parts = [value.slice(1)];
      i += 1;

      while (i < lines.length) {
        const nextLine = lines[i];
        const nextTrimmed = nextLine.trim();

        if (!nextTrimmed) {
          parts.push("");
          i += 1;
          continue;
        }

        const endsQuoted = nextTrimmed.endsWith(quote);
        parts.push(endsQuoted ? nextTrimmed.slice(0, -1) : nextTrimmed);
        i += 1;

        if (endsQuoted) break;
      }

      meta[key] = parts.join(" ").replace(/\s+/g, " ").trim();
      continue;
    }

    meta[key] = cleanInlineValue(value);
    i += 1;
  }

  return { meta, body: match[2] || "" };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(value) {
  return `<![CDATA[${String(value ?? "").replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

function truncate(value, max = 240) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

function cleanInternalUrl(url) {
  return String(url || "").replace(/\.html(?=([?#]|$))/g, "");
}

function normalizeUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return cleanInternalUrl(value);
  if (value.startsWith("/")) return cleanInternalUrl(SITE_URL + value);
  return cleanInternalUrl(SITE_URL + "/" + value);
}

function dateToRss(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toUTCString();
  return date.toUTCString();
}

function imageType(url) {
  const ext = String(url || "").split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  return "image/png";
}

function normalizeHtmlUrls(html) {
  return String(html || "")
    .replace(/(href|src)="\/([^"]+)"/g, (_match, attr, url) => `${attr}="${SITE_URL}/${cleanInternalUrl(url)}"`)
    .replace(/(href|src)='\/([^']+)'/g, (_match, attr, url) => `${attr}='${SITE_URL}/${cleanInternalUrl(url)}'`)
    .replace(/https:\/\/sovazone\.com\/([^\s"'<>]+?)\.html(?=([?#"'<>]|$))/g, "https://sovazone.com/$1");
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").replace(/\r/g, "").split("\n");
  const html = [];
  let paragraph = [];
  let list = null;

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" ").trim())}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!list) return;
    html.push(`</${list}>`);
    list = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    if (/^---+$/.test(line)) {
      flushParagraph();
      closeList();
      html.push("<hr>");
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(heading[1].length, 4);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (list !== "ul") {
        closeList();
        list = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${inlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (list !== "ol") {
        closeList();
        list = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushParagraph();
      closeList();
      html.push(`<p><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}"></p>`);
      continue;
    }

    closeList();
    paragraph.push(line.replace(/ {2,}$/g, ""));
  }

  flushParagraph();
  closeList();

  return normalizeHtmlUrls(html.join("\n"));
}

function extractMeta(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${name}["'][^>]*>`, "i")
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeEntities(match[1]);
  }

  return "";
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTitle(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return cleanText(decodeEntities(h1[1]));

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return cleanText(decodeEntities(title[1]).replace(/\s*\|\s*SovaZone\s*$/i, ""));

  return "";
}

function extractJsonLdArticle(html) {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];

  for (const script of scripts) {
    const jsonText = script.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const data = JSON.parse(jsonText);
      const items = Array.isArray(data) ? data : [data];
      const article = items.find((item) => {
        const type = item?.["@type"];
        return type === "Article" || (Array.isArray(type) && type.includes("Article"));
      });
      if (article) return article;
    } catch (e) {}
  }

  return {};
}

function extractArticleContent(html) {
  const match = html.match(/<article[^>]*class=["'][^"']*article-content[^"']*["'][^>]*>([\s\S]*?)<\/article>/i);
  let content = match ? match[1] : "";

  content = content
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<div[^>]*class=["'][^"']*article-meta[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<div[^>]*class=["'][^"']*post-breadcrumb[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "")
    .trim();

  return normalizeHtmlUrls(content);
}

function buildBlogItems(config) {
  if (!fs.existsSync(config.blogDir)) return [];

  return fs
    .readdirSync(config.blogDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const fullPath = path.join(config.blogDir, file);
      const raw = fs.readFileSync(fullPath, "utf8");
      const { meta, body } = parseFrontmatter(raw);
      const slug = cleanText(meta.slug || file.replace(/\.md$/i, ""));
      const title = cleanText(meta.title || slug, config.defaults.blogTitle);
      const description = cleanText(meta.description || meta.shortDescription || meta.excerpt || "", truncate(body));
      const cover = normalizeUrl(meta.cover || "/og-image.png");
      const content = markdownToHtml(body);

      return {
        type: "blog",
        title,
        slug,
        description,
        category: cleanText(meta.category || config.defaults.category, config.defaults.category),
        author: cleanText(meta.author || config.defaults.author, config.defaults.author),
        date: cleanText(meta.date || ""),
        url: `${SITE_URL}${config.basePath}/post?slug=${encodeURIComponent(slug)}`,
        image: cover,
        content
      };
    });
}

function buildArticleItems(config) {
  if (!fs.existsSync(config.articlesDir)) return [];

  return fs
    .readdirSync(config.articlesDir)
    .filter((file) => file.endsWith(".html"))
    .map((file) => {
      const fullPath = path.join(config.articlesDir, file);
      const html = fs.readFileSync(fullPath, "utf8");
      const jsonLd = extractJsonLdArticle(html);
      const slug = file.replace(/\.html$/i, "");
      const title = cleanText(jsonLd.headline || extractTitle(html), config.defaults.articleTitle);
      const description = cleanText(jsonLd.description || extractMeta(html, "description"), title);
      const rawImage = Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image || extractMeta(html, "og:image") || "/og-image.png";
      const categoryMatch = html.match(/Категория:\s*([^<]+)</i) || html.match(/Category:\s*([^<]+)</i);
      const category = cleanText(categoryMatch ? categoryMatch[1] : config.defaults.category, config.defaults.category);
      const content = extractArticleContent(html);

      return {
        type: "article",
        title,
        slug,
        description,
        category,
        author: config.defaults.articleAuthor,
        date: cleanText(jsonLd.datePublished || config.defaults.articleDate),
        url: `${SITE_URL}${config.basePath}/articles/${encodeURIComponent(slug)}`,
        image: normalizeUrl(rawImage),
        content: content || `<p>${escapeHtml(description)}</p>`
      };
    });
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime();
    const dateB = new Date(b.date || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return a.title.localeCompare(b.title, "ru");
  });
}

function renderItem(item) {
  const image = item.image || `${SITE_URL}/og-image.png`;
  const descriptionHtml = `<p>${escapeHtml(item.description)}</p>`;
  const contentHtml = item.content || descriptionHtml;

  return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <pubDate>${escapeXml(dateToRss(item.date))}</pubDate>
      <dc:creator>${escapeXml(item.author || "SovaZone")}</dc:creator>
      <category>${escapeXml(item.category || "Articles")}</category>
      <description>${cdata(item.description)}</description>
      <content:encoded>${cdata(contentHtml)}</content:encoded>
      <enclosure url="${escapeXml(image)}" type="${escapeXml(imageType(image))}" length="0" />
      <media:content url="${escapeXml(image)}" medium="image" />
    </item>`;
}

function renderFeed({ title, description, link, selfUrl, language, items }) {
  const latestDate = sortItems(items)[0]?.date || new Date().toISOString().slice(0, 10);
  const body = sortItems(items).map(renderItem).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(description)}</description>
    <language>${escapeXml(language)}</language>
    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>
    <pubDate>${escapeXml(dateToRss(latestDate))}</pubDate>
    <image>
      <url>${escapeXml(SITE_URL + "/logo.png")}</url>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
    </image>
${body}
  </channel>
</rss>
`;
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
  console.log(`Updated ${path.relative(ROOT, file)}`);
}

for (const config of FEEDS) {
  const blogItems = sortItems(buildBlogItems(config));
  const articleItems = sortItems(buildArticleItems(config));
  const allItems = sortItems([...blogItems, ...articleItems]);

  const allFeed = renderFeed({
    title: config.titles.all,
    description: config.descriptions.all,
    link: config.links.all,
    selfUrl: `${SITE_URL}${config.basePath}/feed.xml`,
    language: config.language,
    items: allItems
  });

  writeFile(config.outputs.all, allFeed);
  writeFile(config.outputs.allAlias, allFeed.replace(`${SITE_URL}${config.basePath}/feed.xml`, `${SITE_URL}${config.basePath}/rss.xml`));

  writeFile(config.outputs.blog, renderFeed({
    title: config.titles.blog,
    description: config.descriptions.blog,
    link: config.links.blog,
    selfUrl: `${SITE_URL}${config.basePath}/blog-feed.xml`,
    language: config.language,
    items: blogItems
  }));

  writeFile(config.outputs.articles, renderFeed({
    title: config.titles.articles,
    description: config.descriptions.articles,
    link: config.links.articles,
    selfUrl: `${SITE_URL}${config.basePath}/articles-feed.xml`,
    language: config.language,
    items: articleItems
  }));

  console.log(`Generated ${config.code} feeds: ${allItems.length} total items, ${blogItems.length} blog items, ${articleItems.length} article items.`);
}
