/**
 * Credly badge fetching + AWS-certification verification.
 *
 * Credly has no official public "verify any badge" API. AWS issues its
 * certifications as Credly badges, and the Credly website renders each badge
 * from an undocumented public JSON endpoint that needs no auth key:
 *
 *   https://www.credly.com/badges/<uuid>.json   -> { data: { ...badge } }
 *
 * That endpoint sends no CORS headers, so it must be called server-side
 * (which is why this runs inside a Next.js route handler, never the browser).
 *
 * If the JSON endpoint misbehaves we fall back to scraping the public badge
 * page's Open Graph metadata as a best-effort secondary source.
 */

export type VerificationStatus =
  | "valid_aws"
  | "expired_aws"
  | "valid_non_aws"
  | "not_found"
  | "private"
  | "error";

export interface BadgeResult {
  status: VerificationStatus;
  isAws: boolean;
  expired: boolean;
  badgeId: string | null;
  name: string | null;
  description: string | null;
  recipient: string | null;
  issuer: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  imageUrl: string | null;
  skills: string[];
  badgeUrl: string | null;
  source: "obi" | "html" | null;
  message?: string;
}

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// IMPORTANT: do not advertise text/html when requesting JSON. Credly's API
// does content negotiation and will return an HTML page (breaking JSON.parse)
// if text/html is acceptable. JSON requests must ask for JSON only.
const ACCEPT_JSON = "application/json, */*;q=0.1";
const ACCEPT_HTML = "text/html,application/xhtml+xml,*/*";

/**
 * Accepts a raw badge UUID, a credly.com badge URL, or pasted text containing
 * one, and returns the normalized lowercase UUID (or null if none found).
 */
export function extractBadgeId(input: string): string | null {
  if (!input) return null;
  const match = input.trim().match(UUID_RE);
  return match ? match[0].toLowerCase() : null;
}

function isAwsIssuer(issuer: string | null): boolean {
  if (!issuer) return false;
  return issuer.toLowerCase().includes("amazon web services");
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return false;
  return ts < Date.now();
}

function classify(isAws: boolean, expired: boolean): VerificationStatus {
  if (isAws) return expired ? "expired_aws" : "valid_aws";
  return "valid_non_aws";
}

async function fetchWithTimeout(
  url: string,
  accept: string = ACCEPT_JSON,
  ms = 10_000,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: accept,
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface ObiAssertion {
  badge?: string; // URL pointing to the BadgeClass
  issuedOn?: string;
  expires?: string | null;
  data?: unknown; // present only in Credly's error envelope
}

interface ObiBadgeClass {
  name?: string;
  description?: string;
  image?: { id?: string } | string;
  tags?: string[];
  issuer?: { name?: string };
}

function obiImageUrl(image: ObiBadgeClass["image"]): string | null {
  if (!image) return null;
  return typeof image === "string" ? image : (image.id ?? null);
}

/**
 * Primary source: Credly's public Open Badges (OBI) endpoints.
 *
 *   /v1/obi/v2/badge_assertions/<id>  -> issuedOn, expires, link to badge class
 *   <badge class url>                 -> name, issuer, description, image, tags
 *
 * The assertion hashes the recipient's email, so the human-readable recipient
 * name is enriched separately from the public page's Open Graph title.
 */
async function fetchFromObi(badgeId: string): Promise<BadgeResult | null> {
  const assertionRes = await fetchWithTimeout(
    `https://api.credly.com/v1/obi/v2/badge_assertions/${badgeId}`,
  );
  if (!assertionRes) return null;
  if (assertionRes.status === 404) {
    return { ...emptyResult(badgeId), status: "not_found" };
  }
  if (!assertionRes.ok) return null;

  let assertion: ObiAssertion;
  try {
    assertion = await assertionRes.json();
  } catch {
    return null;
  }
  // Credly's error envelope is { data: { message } }, never a real assertion.
  if (!assertion || !assertion.badge || assertion.data) return null;

  const classRes = await fetchWithTimeout(assertion.badge);
  if (!classRes || !classRes.ok) return null;
  let badgeClass: ObiBadgeClass;
  try {
    badgeClass = await classRes.json();
  } catch {
    return null;
  }

  const issuer = badgeClass.issuer?.name ?? null;
  const expiresAt = assertion.expires ?? null;
  const isAws = isAwsIssuer(issuer);
  const expired = isExpired(expiresAt);
  const recipient = await fetchOgRecipient(badgeId);

  return {
    status: classify(isAws, expired),
    isAws,
    expired,
    badgeId,
    name: badgeClass.name ?? null,
    description: badgeClass.description ?? null,
    recipient,
    issuer,
    issuedAt: assertion.issuedOn ?? null,
    expiresAt,
    imageUrl: obiImageUrl(badgeClass.image),
    skills: (badgeClass.tags ?? []).filter((t): t is string => Boolean(t)),
    badgeUrl: `https://www.credly.com/badges/${badgeId}/public_url`,
    source: "obi",
  };
}

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  return m ? decodeHtml(m[1]) : null;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

async function fetchBadgeHtml(badgeId: string): Promise<string | null> {
  const res = await fetchWithTimeout(
    `https://www.credly.com/badges/${badgeId}/public_url`,
    ACCEPT_HTML,
  );
  if (!res || !res.ok) return null;
  return res.text();
}

/**
 * Credly badge titles read like:
 *   "<Cert>[ (Expired)] was issued by <Issuer> to <Recipient>."
 */
function parseTitle(title: string): {
  name: string;
  issuer: string | null;
  recipient: string | null;
  expired: boolean;
} {
  let name = title;
  let issuer: string | null = null;
  let recipient: string | null = null;
  const m = title.match(/^(.*?) was issued by (.*?) to (.*?)\.?$/i);
  if (m) {
    name = m[1].trim();
    issuer = m[2].trim();
    recipient = m[3].trim();
  }
  // Credly appends "(Expired)" to the name in the title for lapsed credentials.
  let expired = false;
  if (/\(expired\)\s*$/i.test(name)) {
    expired = true;
    name = name.replace(/\s*\(expired\)\s*$/i, "").trim();
  }
  return { name, issuer, recipient, expired };
}

/** Enrich the OBI result with the recipient's plaintext name. */
async function fetchOgRecipient(badgeId: string): Promise<string | null> {
  const html = await fetchBadgeHtml(badgeId);
  if (!html) return null;
  const title = metaContent(html, "og:title");
  return title ? parseTitle(title).recipient : null;
}

/**
 * Fallback source: parse the public badge page's Open Graph tags. Provides
 * issuer, cert name, recipient, description, image and expired status, but not
 * issue/expiry dates or skills (those only come from the OBI path).
 */
async function fetchFromHtml(badgeId: string): Promise<BadgeResult | null> {
  const html = await fetchBadgeHtml(badgeId);
  if (!html) return null;
  const title = metaContent(html, "og:title");
  const image = metaContent(html, "og:image");
  const description = metaContent(html, "og:description");
  if (!title) return null;

  const parsed = parseTitle(title);
  let issuer = parsed.issuer;
  if (!issuer && /amazon web services/i.test(`${title} ${description ?? ""}`)) {
    issuer = "Amazon Web Services Training and Certification";
  }

  const isAws = isAwsIssuer(issuer ?? `${title} ${description ?? ""}`);
  return {
    status: classify(isAws, parsed.expired),
    isAws,
    expired: parsed.expired,
    badgeId,
    name: parsed.name,
    description,
    recipient: parsed.recipient,
    issuer,
    issuedAt: null,
    expiresAt: null,
    imageUrl: image,
    skills: [],
    badgeUrl: `https://www.credly.com/badges/${badgeId}/public_url`,
    source: "html",
  };
}

function emptyResult(badgeId: string | null): BadgeResult {
  return {
    status: "error",
    isAws: false,
    expired: false,
    badgeId,
    name: null,
    description: null,
    recipient: null,
    issuer: null,
    issuedAt: null,
    expiresAt: null,
    imageUrl: null,
    skills: [],
    badgeUrl: badgeId
      ? `https://www.credly.com/badges/${badgeId}/public_url`
      : null,
    source: null,
  };
}

export async function verifyBadge(rawInput: string): Promise<BadgeResult> {
  const badgeId = extractBadgeId(rawInput);
  if (!badgeId) {
    return {
      ...emptyResult(null),
      status: "error",
      message:
        "Couldn't find a Credly badge ID. Paste a badge link like " +
        "https://www.credly.com/badges/<id> or the ID itself.",
    };
  }

  const fromObi = await fetchFromObi(badgeId);
  if (fromObi) return fromObi;

  const fromHtml = await fetchFromHtml(badgeId);
  if (fromHtml) return fromHtml;

  return {
    ...emptyResult(badgeId),
    status: "not_found",
    message:
      "Couldn't retrieve this badge from Credly. It may not exist, may be " +
      "private, or Credly may be temporarily unavailable.",
  };
}
