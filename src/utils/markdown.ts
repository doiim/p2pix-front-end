import DOMPurify from 'dompurify';
import { Marked } from 'marked';

// Content rendered through v-html is markdown, never HTML: raw HTML renders as
// visible text so authors see their mistake instead of a silent mutation.
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

const markdown = new Marked({
  breaks: true,
  gfm: true,
  renderer: {
    html: ({ text }) => escapeHtml(text),
    checkbox: ({ checked }) => (checked ? '☑ ' : '☐ '),
  },
});

// URI policy must run after HTML attribute decoding: `[x](&#106;avascript:…)`
// looks relative to any check on the markdown href. DOMPurify's default
// allow-list plus `ipfs:`, which release links carry.
const ALLOWED_URI_REGEXP =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|ipfs):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

export const renderMarkdown = (md: string): string =>
  DOMPurify.sanitize(markdown.parse(md, { async: false }), {
    ALLOWED_URI_REGEXP,
  });
