import raw from '../../../site.config.json';

export interface SiteConfig {
  /** Personal number length. One parameter, per the spec (default 7). */
  PN_LENGTH: number;
  TEAMS: string[];
  /** Apps Script Web App URL. Empty = events stay in the local queue. */
  TRACKING_URL: string;
  WATERMARK: string;
  /** SHA-256 hex of the instructor code. Not a security boundary, only keeps notes out of sight. */
  INSTRUCTOR_CODE_SHA256: string;
  SITE_TITLE: string;
}

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};

export const config: SiteConfig = {
  ...(raw as SiteConfig),
  SITE_TITLE: (typeof __SITE_TITLE__ === 'string' && __SITE_TITLE__) || (raw as SiteConfig).SITE_TITLE,
  TRACKING_URL: env.VITE_TRACKING_URL || (raw as SiteConfig).TRACKING_URL,
};

/** Root of the whole site (e.g. "/bahad_1_AI_studying/"), injected at build time. */
export const SITE_BASE: string = typeof __SITE_BASE__ === 'string' ? __SITE_BASE__ : '/';
