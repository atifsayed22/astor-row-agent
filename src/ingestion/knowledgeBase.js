import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

const KNOWLEDGE_BASE_PATH = path.resolve(
  process.cwd(),
  "knowledge-base"
);

export async function loadDocuments() {
  const files = await fs.readdir(KNOWLEDGE_BASE_PATH);

  const markdownFiles = files.filter((file) => file.endsWith(".md"));

  const documents = [];

  for (const filename of markdownFiles) {
    const filePath = path.join(KNOWLEDGE_BASE_PATH, filename);

    const rawContent = await fs.readFile(filePath, "utf-8");

    const { data, content } = matter(rawContent);

    documents.push({
      source: filename,
      metadata: data,
      content: content.trim(),
    });
  }

  return documents;
}

export function chunkDocument(document) {
  const lines = document.content.split(/\r?\n/);

  const chunks = [];

  let currentHeading = null;
  let currentContent = [];

  function saveChunk() {
    const text = currentContent.join("\n").trim();

    if (!text) return;

    chunks.push({
      source: document.source,
      documentId: document.metadata.document_id,
      title: document.metadata.title,
      heading: currentHeading,
      content: text,
      metadata: {
        ...document.metadata,
      },
    });
  }

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);

    if (headingMatch) {
      saveChunk();

      currentHeading = headingMatch[1].trim();
      currentContent = [];

      continue;
    }

    // Ignore "# Returns Policy"
    if (/^#\s+/.test(line)) {
      continue;
    }

    currentContent.push(line);
  }

  saveChunk();

  return chunks;
}

export function chunkDocuments(documents) {
  return documents.flatMap((document) =>
    chunkDocument(document)
  );
}