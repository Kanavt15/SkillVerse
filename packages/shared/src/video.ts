/**
 * Lesson videos hosted on YouTube or Vimeo.
 *
 * Instructors paste any common link form; we store only { provider, ref }
 * where ref is the platform's video id, validated against a strict pattern.
 * Embed URLs are rebuilt from that id by `videoEmbedUrl`, so a lesson can never
 * make the player load an arbitrary URL (no iframe injection).
 *
 * R2-hosted uploads (provider "r2") arrive with file uploads.
 */

export type HostedVideoProvider = 'youtube' | 'vimeo';

export interface ParsedVideo {
  provider: HostedVideoProvider;
  ref: string;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;

/** Parses a YouTube or Vimeo link. Returns null for anything else. */
export function parseVideoUrl(input: string): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^www\.|^m\./, '');
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    return YOUTUBE_ID.test(parts[0] ?? '') ? { provider: 'youtube', ref: parts[0]! } : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id =
      parts[0] === 'watch'
        ? url.searchParams.get('v')
        : ['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')
          ? parts[1]
          : null;
    return id && YOUTUBE_ID.test(id) ? { provider: 'youtube', ref: id } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = host === 'player.vimeo.com' ? parts[1] : parts[0];
    return id && VIMEO_ID.test(id) ? { provider: 'vimeo', ref: id } : null;
  }
  return null;
}

/**
 * Embed URL for the player iframe. YouTube uses the privacy-enhanced
 * youtube-nocookie.com domain (no tracking cookies until the viewer presses play).
 */
export function videoEmbedUrl(provider: HostedVideoProvider, ref: string): string | null {
  if (provider === 'youtube' && YOUTUBE_ID.test(ref)) {
    return `https://www.youtube-nocookie.com/embed/${ref}?rel=0&modestbranding=1`;
  }
  if (provider === 'vimeo' && VIMEO_ID.test(ref)) {
    return `https://player.vimeo.com/video/${ref}?dnt=1`;
  }
  return null;
}

/** A shareable watch URL (shown to instructors in the editor). */
export function videoWatchUrl(provider: HostedVideoProvider, ref: string): string {
  return provider === 'youtube'
    ? `https://www.youtube.com/watch?v=${ref}`
    : `https://vimeo.com/${ref}`;
}
