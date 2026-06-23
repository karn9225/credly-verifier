import type { BadgeResult, VerificationStatus } from "@/lib/credly";

type Tone = "green" | "amber" | "red" | "slate";

const STATUS_META: Record<
  VerificationStatus,
  { label: string; tone: Tone; blurb: string }
> = {
  valid_aws: {
    label: "Verified AWS Certification",
    tone: "green",
    blurb: "Issued by Amazon Web Services and currently valid.",
  },
  expired_aws: {
    label: "AWS Certification — Expired",
    tone: "amber",
    blurb: "Genuinely issued by AWS, but past its expiration date.",
  },
  valid_non_aws: {
    label: "Not an AWS Certification",
    tone: "slate",
    blurb: "This is a real Credly badge, but AWS is not the issuer.",
  },
  private: {
    label: "Badge is Private",
    tone: "slate",
    blurb: "The badge exists but its owner has not made it public.",
  },
  not_found: {
    label: "Badge Not Found",
    tone: "red",
    blurb: "Couldn't retrieve this badge from Credly.",
  },
  error: {
    label: "Error",
    tone: "red",
    blurb: "Something went wrong.",
  },
};

const TONE_CLASSES: Record<Tone, { ring: string; chip: string; dot: string }> =
  {
    green: {
      ring: "border-emerald-500/40",
      chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      dot: "bg-emerald-400",
    },
    amber: {
      ring: "border-amber-500/40",
      chip: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      dot: "bg-amber-400",
    },
    red: {
      ring: "border-red-500/40",
      chip: "bg-red-500/15 text-red-300 border-red-500/30",
      dot: "bg-red-400",
    },
    slate: {
      ring: "border-white/10",
      chip: "bg-white/10 text-slate-300 border-white/15",
      dot: "bg-slate-400",
    },
  };

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return value;
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ResultCard({ result }: { result: BadgeResult }) {
  const meta = STATUS_META[result.status];
  const tone = TONE_CLASSES[meta.tone];
  const hasDetails = Boolean(result.name || result.recipient);

  return (
    <div className={`rounded-2xl border ${tone.ring} bg-white/[0.03] p-6`}>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${tone.chip}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          {meta.label}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-400">{meta.blurb}</p>

      {hasDetails && (
        <div className="mt-5 flex flex-col gap-5 sm:flex-row">
          {result.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.imageUrl}
              alt={result.name ?? "Badge"}
              className="h-28 w-28 shrink-0 self-center rounded-xl object-contain sm:self-start"
            />
          )}
          <div className="min-w-0 flex-1">
            {result.name && (
              <h2 className="text-lg font-semibold leading-snug text-slate-100">
                {result.name}
              </h2>
            )}
            <dl className="mt-3 grid grid-cols-1 gap-y-2 text-sm">
              <Row label="Issuer" value={result.issuer} highlight={result.isAws} />
              <Row label="Issued to" value={result.recipient} />
              <Row label="Issued on" value={formatDate(result.issuedAt)} />
              <Row
                label="Expires"
                value={
                  result.expiresAt
                    ? formatDate(result.expiresAt) +
                      (result.expired ? "  (expired)" : "")
                    : result.issuedAt
                      ? "No expiration"
                      : null
                }
              />
            </dl>
          </div>
        </div>
      )}

      {result.skills.length > 0 && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Skills
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.skills.slice(0, 12).map((skill) => (
              <span
                key={skill}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-300"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {result.description && (
        <p className="mt-5 border-t border-white/5 pt-4 text-sm leading-relaxed text-slate-400">
          {result.description}
        </p>
      )}

      {result.badgeUrl && (
        <a
          href={result.badgeUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-orange-300 transition hover:text-orange-200"
        >
          View on Credly
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 17L17 7M17 7H9M17 7v8" />
          </svg>
        </a>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | null;
  highlight?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-slate-500">{label}</dt>
      <dd
        className={`min-w-0 flex-1 ${
          highlight ? "font-medium text-orange-300" : "text-slate-200"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
