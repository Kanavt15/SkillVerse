/** Safe user-authored Markdown: no raw HTML, embedded media, remote images or scriptable links. */
import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

export function SafeMarkdown({ children }: { children: string }) {
  return (
    <div className="markdown-content">
      <Markdown
        skipHtml
        rehypePlugins={[rehypeSanitize]}
        disallowedElements={['img', 'iframe']}
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
          a: ({ children, href }) => (
            <a href={href} rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
