import { describe, expect, it } from 'vitest';
import { parseVideoUrl, videoEmbedUrl } from './video';

describe('parseVideoUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('reads YouTube links: %s', (url, id) => {
    expect(parseVideoUrl(url)).toEqual({ provider: 'youtube', ref: id });
  });

  it.each([
    ['https://vimeo.com/76979871', '76979871'],
    ['https://player.vimeo.com/video/76979871', '76979871'],
  ])('reads Vimeo links: %s', (url, id) => {
    expect(parseVideoUrl(url)).toEqual({ provider: 'vimeo', ref: id });
  });

  it.each([
    'javascript:alert(1)',
    'https://evil.example/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ"><script>',
    'https://vimeo.com/channels/staffpicks',
    'not a url',
    '',
  ])('rejects %s', (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });
});

describe('videoEmbedUrl', () => {
  it('builds privacy-friendly embed URLs only from valid ids', () => {
    expect(videoEmbedUrl('youtube', 'dQw4w9WgXcQ')).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/,
    );
    expect(videoEmbedUrl('vimeo', '76979871')).toMatch(
      /^https:\/\/player\.vimeo\.com\/video\/76979871\?dnt=1$/,
    );
    expect(videoEmbedUrl('youtube', '../../evil')).toBeNull();
    expect(videoEmbedUrl('vimeo', 'abc')).toBeNull();
  });
});
