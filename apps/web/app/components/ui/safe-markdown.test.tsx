import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SafeMarkdown } from './safe-markdown';

afterEach(cleanup);

describe('SafeMarkdown', () => {
  it('renders useful lesson formatting without introducing another page heading', () => {
    render(
      <SafeMarkdown>
        {'# Lesson\n\n**Practice** this:\n\n```js\nconst total = 3;\n```'}
      </SafeMarkdown>,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Lesson');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByText('Practice').tagName).toBe('STRONG');
    expect(screen.getByText('const total = 3;').tagName).toBe('CODE');
  });

  it('removes executable HTML and unsolicited embedded media', () => {
    const { container } = render(
      <SafeMarkdown>
        {
          '<script>alert(1)</script>\n\n<iframe src="https://evil.test"></iframe>\n\n<img src="x" onerror="alert(1)" />\n\n![tracking](https://evil.test/pixel)'
        }
      </SafeMarkdown>,
    );
    expect(container.querySelector('script, iframe, img')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
  });

  it('rejects scriptable links while preserving normal course references', () => {
    render(
      <SafeMarkdown>
        {'[Unsafe](javascript:alert%281%29)\n\n[Reference](https://example.com/lesson)'}
      </SafeMarkdown>,
    );
    expect(screen.getByText('Unsafe').getAttribute('href')).toBeFalsy();
    const reference = screen.getByRole('link', { name: 'Reference' });
    expect(reference.getAttribute('href')).toBe('https://example.com/lesson');
    expect(reference.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
