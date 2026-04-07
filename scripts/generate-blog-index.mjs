import fs from "node:fs";
import path from "node:path";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const OUTPUT_FILE = path.join(BLOG_DIR, "index.json");

function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return {};

  const frontmatter = match[1];
  const meta = {};

  for (const line of frontmatter.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    meta[key] = value;
  }

  return meta;
}

function getBlogFiles() {
  if (!fs.existsSync(BLOG_DIR)) {
    throw new Error(`Blog directory not found: ${BLOG_DIR}`);
  }

  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".md"))
    .sort();
}

function buildIndex() {
  const files = getBlogFiles();
  const posts = [];

  for (const file of files) {
    const fullPath = path.join(BLOG_DIR, file);
    const raw = fs.readFileSync(fullPath, "utf8");
    const meta = parseFrontmatter(raw);

    const filenameSlug = file.replace(/\.md$/i, "");
    const slug = (meta.slug || filenameSlug).trim();

    posts.push({
      title: (meta.title || slug).trim(),
      slug,
      date: (meta.date || "").trim(),
      description: (meta.description || "").trim(),
      category: (meta.category || "Статьи").trim(),
      author: (meta.author || "SovaZone").trim(),
      cover: (meta.cover || "").trim()
    });
  }

  posts.sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime();
    const dateB = new Date(b.date || 0).getTime();
    return dateB - dateA;
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(posts, null, 2) + "\n", "utf8");
  console.log(`Updated ${OUTPUT_FILE} with ${posts.length} posts.`);
}

buildIndex();
