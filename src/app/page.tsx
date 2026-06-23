"use client";

import { useState } from "react";
import type { BadgeResult } from "@/lib/credly";
import { ResultCard } from "@/components/ResultCard";

const EXAMPLE_PLACEHOLDER =
  "https://www.credly.com/badges/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BadgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data: BadgeResult = await res.json();
      if (data.status === "error") {
        setError(data.message ?? "Something went wrong.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error — could not reach the verifier.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-12 sm:py-20">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          AWS Certification Verifier
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
          Paste a Credly badge link or ID to confirm it&apos;s a genuine AWS
          certification — issued by Amazon Web Services — and see its details.
        </p>
      </header>

      <form onSubmit={onSubmit} className="mt-10">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={EXAMPLE_PLACEHOLDER}
            spellCheck={false}
            autoComplete="off"
            className="w-full flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-orange-400/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-orange-400/20"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </div>
      </form>

      <section className="mt-8">
        {loading && <SkeletonCard />}
        {!loading && error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        {!loading && result && <ResultCard result={result} />}
        {!loading && !error && !result && <EmptyHint />}
      </section>

      <footer className="mt-auto pt-12 text-center text-xs text-slate-600">
        Data from Credly&apos;s public badge endpoints. Not affiliated with
        Amazon Web Services or Credly.
      </footer>
    </main>
  );
}

function EmptyHint() {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-5 py-6 text-center text-sm text-slate-500">
      <p>
        Tip: on any Credly badge page, copy the share URL. It looks like{" "}
        <code className="rounded bg-white/5 px-1.5 py-0.5 text-slate-300">
          credly.com/badges/&lt;id&gt;
        </code>
        .
      </p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex gap-5">
        <div className="h-24 w-24 shrink-0 rounded-xl bg-white/10" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 w-2/3 rounded bg-white/10" />
          <div className="h-3 w-1/3 rounded bg-white/10" />
          <div className="h-3 w-1/2 rounded bg-white/10" />
        </div>
      </div>
    </div>
  );
}
