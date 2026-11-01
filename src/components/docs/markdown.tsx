import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

/**
 * Renders repository documentation. The source is trusted local markdown, and
 * angle brackets are escaped before parsing so raw HTML cannot be injected.
 */
export function Markdown({ source }: { source: string }) {
  const html = marked.parse(source.replace(/</g, "&lt;"), { async: false }) as string;
  return <div className="doc-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
