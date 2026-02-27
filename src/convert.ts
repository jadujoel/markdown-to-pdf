import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import puppeteer from "puppeteer";

const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  })
);

type ConvertOptions = {
  preventImageSplit?: boolean;
};

const htmlTemplate = (body: string, options: Required<ConvertOptions>) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap');

  :root {
    --text: #1a1a2e;
    --text-secondary: #4a4a6a;
    --bg: #ffffff;
    --accent: #4361ee;
    --border: #e2e8f0;
    --code-bg: #f8fafc;
    --blockquote-border: #4361ee;
    --blockquote-bg: #f0f4ff;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--text);
    background: var(--bg);
    line-height: 1.75;
    font-size: 15px;
    padding: 60px 72px;
    max-width: 900px;
    margin: 0 auto;
  }

  h1, h2, h3, h4, h5, h6 {
    color: var(--text);
    font-weight: 700;
    line-height: 1.3;
    margin-top: 2em;
    margin-bottom: 0.75em;
  }

  h1 {
    font-size: 2.25em;
    border-bottom: 3px solid var(--accent);
    padding-bottom: 0.4em;
    margin-top: 0;
  }

  h2 {
    font-size: 1.65em;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.3em;
  }

  h3 { font-size: 1.35em; }
  h4 { font-size: 1.15em; }

  p { margin-bottom: 1em; }

  a {
    color: var(--accent);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;
  }
  a:hover { border-bottom-color: var(--accent); }

  strong { font-weight: 600; }

  blockquote {
    border-left: 4px solid var(--blockquote-border);
    background: var(--blockquote-bg);
    padding: 1em 1.5em;
    margin: 1.5em 0;
    border-radius: 0 8px 8px 0;
    color: var(--text-secondary);
  }
  blockquote p:last-child { margin-bottom: 0; }

  code {
    font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
    font-size: 0.88em;
    background: var(--code-bg);
    padding: 0.2em 0.45em;
    border-radius: 4px;
    border: 1px solid var(--border);
  }

  pre {
    background: #1e293b;
    color: #e2e8f0;
    border-radius: 10px;
    padding: 1.25em 1.5em;
    margin: 1.5em 0;
    overflow-x: auto;
    line-height: 1.6;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  }

  pre code {
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    font-size: 0.85em;
  }

  /* highlight.js One Dark-ish theme for code blocks */
  .hljs-keyword, .hljs-selector-tag { color: #c678dd; }
  .hljs-string, .hljs-template-variable { color: #98c379; }
  .hljs-number, .hljs-literal { color: #d19a66; }
  .hljs-comment { color: #5c6370; font-style: italic; }
  .hljs-function .hljs-title, .hljs-title.function_ { color: #61afef; }
  .hljs-built_in { color: #e5c07b; }
  .hljs-attr { color: #d19a66; }
  .hljs-type, .hljs-class .hljs-title { color: #e5c07b; }
  .hljs-params { color: #abb2bf; }
  .hljs-meta { color: #61afef; }
  .hljs-tag { color: #e06c75; }
  .hljs-name { color: #e06c75; }
  .hljs-attribute { color: #d19a66; }

  ul, ol {
    margin: 1em 0;
    padding-left: 2em;
  }

  li { margin-bottom: 0.4em; }
  li > ul, li > ol { margin: 0.3em 0; }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5em 0;
    font-size: 0.93em;
  }

  th {
    background: #f1f5f9;
    font-weight: 600;
    text-align: left;
    padding: 0.75em 1em;
    border-bottom: 2px solid var(--border);
  }

  td {
    padding: 0.65em 1em;
    border-bottom: 1px solid var(--border);
  }

  tr:hover td { background: #f8fafc; }

  img {
    max-width: 100%;
    width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 1em 0;
    display: block;
  }

  svg {
    max-width: 100%;
    height: auto;
    display: block;
  }

  figure {
    max-width: 100%;
    margin: 1em 0;
  }

  ${options.preventImageSplit ? `
  img {
    max-height: 200mm;
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-before: auto;
    page-break-after: auto;
  }

  /* Markdown renders images inside <p> tags — the container must also avoid splits */
  p:has(> img) {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  figure img,
  svg {
    max-height: 200mm;
  }

  figure,
  svg,
  pre,
  table,
  blockquote {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  ` : ""}

  h1, h2, h3, h4, h5, h6 {
    page-break-after: avoid;
    break-after: avoid;
  }

  hr {
    border: none;
    border-top: 2px solid var(--border);
    margin: 2.5em 0;
  }

  /* Checklist */
  ul:has(> li > input[type="checkbox"]) {
    list-style: none;
    padding-left: 0.5em;
  }
</style>
</head>
<body>${body}</body>
</html>`;

let browserInstance: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserInstance;
}

export async function convertMarkdown(
  markdown: string,
  format: "pdf" | "png",
  options: ConvertOptions = {}
): Promise<Uint8Array> {
  const resolvedOptions: Required<ConvertOptions> = {
    preventImageSplit: options.preventImageSplit ?? true,
  };
  const htmlBody = await marked.parse(markdown);
  const fullHtml = htmlTemplate(htmlBody, resolvedOptions);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(fullHtml, { waitUntil: "networkidle0" });

    if (format === "pdf") {
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      });
      return Buffer.from(pdf);
    } else {
      await page.setViewport({ width: 900, height: 100 });
      // Let the page determine its own height
      const bodyHandle = await page.$("body");
      const { height } = await bodyHandle!.boundingBox() as { height: number };
      await page.setViewport({ width: 900, height: Math.ceil(height) + 40 });
      const png = await page.screenshot({
        type: "png",
        fullPage: true,
        omitBackground: false,
      });
      return Buffer.from(png);
    }
  } finally {
    await page.close();
  }
}
