import fs from "node:fs";
import path from "node:path";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const OUTPUT_FILE = path.join(BLOG_DIR, "index.json");

function stripMatchingQuotes(value) {
  if (!value) return value;

  const first = value[0];
  const last = value[value.length - 1];
  const isQuoted =
    (first === '"' && last === '"') ||
    (first === "'" && last === "'");

  return isQuoted ? value.slice(1, -1) : value;
}

function cleanInlineValue(value) {
  return stripMatchingQuotes(String(value || "").trim());
}

function foldBlockValue(lines, mode) {
  const normalized = lines
    .map((line) => line.replace(/\r/g, ""))
    .map((line) => line.replace(/^\s+/, ""))
    .join(mode === "|" ? "\n" : " ")
    .replace(/\s+/g, mode === "|" ? " " : " ")
    .trim();

  return normalized;
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return {};

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

    // YAML folded / literal block scalars:
    // description: >
    // description: |
    if (value === ">" || value === "|") {
      const mode = value;
      const blockLines = [];
      i += 1;

      while (i < lines.length) {
        const nextLine = lines[i];
        const nextTrimmed = nextLine.trim();

        // Keep empty lines inside block
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

    // Multiline quoted string:
    // description: "text
    // more text"
    if (
      (value.startsWith('"') && !value.endsWith('"')) ||
      (value.startsWith("'") && !value.endsWith("'"))
    ) {
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

function pickDescription(meta) {
  return (
    meta.shortDescription ||
    meta.short_description ||
    meta.description ||
    meta.excerpt ||
    meta.summary ||
    meta.metaDescription ||
    meta.meta_description ||
    ""
  ).trim();
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
      description: pickDescription(meta),
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
