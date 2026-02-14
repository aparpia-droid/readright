// frontend/src/App.js
import React, { useMemo, useState } from "react";

const DEFAULT_API_BASE = "https://readright-1hiy.onrender.com";
const API_BASE = (process.env.REACT_APP_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function formatNum(n, digits = 2) {
  if (typeof n !== "number" || Number.isNaN(n)) return "-";
  return n.toFixed(digits);
}

export default function App() {
  const [apiBase, setApiBase] = useState(API_BASE);

  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");

  const [loading, setLoading] = useState(false);
  const [statusPill, setStatusPill] = useState("Idle");
  const [error, setError] = useState("");

  const [analysis, setAnalysis] = useState(null);

  // Filters
  const [minRisk, setMinRisk] = useState(1);
  const [topN, setTopN] = useState(10);

  // Rewrite feature
  // key: sentence string, value: { loading, error, output }
  const [rewriteBySentence, setRewriteBySentence] = useState({});

  const allSorted = useMemo(() => {
    if (!analysis?.all_sentences) return [];
    const arr = [...analysis.all_sentences];
    arr.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return arr;
  }, [analysis]);

  const filtered = useMemo(() => {
    const min = clamp(Number(minRisk) || 0, 0, 999);
    return allSorted.filter((x) => (x.score ?? 0) >= min);
  }, [allSorted, minRisk]);

  const topShown = useMemo(() => {
    const n = clamp(Number(topN) || 10, 1, 200);
    return filtered.slice(0, n);
  }, [filtered, topN]);

  const judgeFriendly = useMemo(() => {
    // Use backend "top_risk_sentences" if present; else fall back to topShown
    if (analysis?.top_risk_sentences?.length) return analysis.top_risk_sentences;
    return topShown.slice(0, 5);
  }, [analysis, topShown]);

  async function analyzePdf() {
    if (!file) {
      setError("Choose a PDF first.");
      return;
    }

    setError("");
    setLoading(true);
    setStatusPill("Analyzing…");

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${apiBase}/analyze`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Analyze failed (${res.status}). ${txt}`);
      }

      const data = await res.json();

      setAnalysis(data);
      setStatusPill("Done");

      // reset filters to sane defaults based on data
      setMinRisk(1);
      setTopN(10);

      // clear old rewrites (optional)
      setRewriteBySentence({});
    } catch (e) {
      setStatusPill("Error");
      setError(e?.message || "Analyze failed.");
    } finally {
      setLoading(false);
    }
  }

  async function rewriteSentence(sentence, mode = "plain_english") {
    const key = sentence;

    // already have output -> no need to refetch
    const existing = rewriteBySentence[key];
    if (existing?.output && !existing?.error) return;

    setRewriteBySentence((prev) => ({
      ...prev,
      [key]: { loading: true, error: "", output: prev?.[key]?.output || "" },
    }));

    try {
      const res = await fetch(`${apiBase}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence, mode }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Rewrite failed (${res.status}). ${txt}`);
      }

      const data = await res.json();
      const out = data?.rewrite || data?.rewritten || data?.text || "";

      setRewriteBySentence((prev) => ({
        ...prev,
        [key]: { loading: false, error: "", output: out || "(empty rewrite)" },
      }));
    } catch (e) {
      setRewriteBySentence((prev) => ({
        ...prev,
        [key]: { loading: false, error: e?.message || "Rewrite failed.", output: "" },
      }));
    }
  }

  function onPickFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setFileName(f ? f.name : "");
    setAnalysis(null);
    setError("");
    setStatusPill("Ready");
    setRewriteBySentence({});
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.title}>ReadRight</div>
          <div style={styles.subtitle}>PDF readability + risk hotspots (Render backend)</div>
        </div>
      </div>

      <div style={styles.toolbar}>
        <input
          type="file"
          accept="application/pdf"
          onChange={onPickFile}
          style={styles.fileInput}
        />

        <button onClick={analyzePdf} disabled={loading || !file} style={styles.primaryBtn}>
          {loading ? "Analyzing…" : "Analyze PDF"}
        </button>

        <div style={styles.pillRow}>
          <span style={styles.pill}>API: {apiBase}</span>
          {fileName ? <span style={styles.pill}>{fileName}</span> : null}
          <span
            style={{
              ...styles.pill,
              ...(statusPill === "Done"
                ? styles.pillGreen
                : statusPill === "Error"
                ? styles.pillRed
                : styles.pillGray),
            }}
          >
            {statusPill}
          </span>
        </div>
      </div>

      {/* Optional: allow changing API base without env var */}
      <div style={styles.apiBox}>
        <div style={styles.apiBoxLabel}>API Base</div>
        <input
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value.replace(/\/$/, ""))}
          placeholder={DEFAULT_API_BASE}
          style={styles.apiInput}
        />
        <div style={styles.apiHint}>
          Tip: set <code>REACT_APP_API_BASE</code> in your environment for production.
        </div>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      {analysis ? (
        <div style={styles.grid}>
          {/* Metrics */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>Metrics</div>
            <div style={styles.metricLine}>
              <b>Readability Grade Level:</b> {formatNum(analysis.grade_level, 2)}
            </div>
            <div style={styles.metricLine}>
              <b>Estimated Reading Time (min):</b> {formatNum(analysis.reading_time_minutes, 2)}
            </div>
            <div style={styles.metricLine}>
              <b>Total Sentences Scored:</b> {analysis.total_sentences ?? "-"}
            </div>
            <div style={styles.metricLine}>
              <b>Average Risk Score:</b> {formatNum(analysis.average_risk_score, 2)}
            </div>
          </div>

          {/* Filters */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>Filters (for product-style exploration)</div>

            <div style={styles.filterRow}>
              <div style={styles.filterLabel}>Min risk score:</div>
              <input
                type="range"
                min={0}
                max={10}
                value={minRisk}
                onChange={(e) => setMinRisk(Number(e.target.value))}
                style={styles.range}
              />
              <span style={styles.badge}>{minRisk}+</span>
            </div>

            <div style={styles.filterRow}>
              <div style={styles.filterLabel}>Show top N:</div>
              <input
                type="number"
                min={1}
                max={200}
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                style={styles.number}
              />
              <span style={styles.badge}>{topShown.length} shown</span>
            </div>

            <div style={styles.smallNote}>
              This makes the demo feel like a product: users can explore risk hotspots without
              re-uploading.
            </div>
          </div>

          {/* Top Hotspots */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>Top Hotspots (judge-friendly)</div>
            <div style={styles.list}>
              {judgeFriendly.map((x, idx) => (
                <SentenceCard
                  key={`top-${idx}`}
                  sentence={x.sentence}
                  score={x.score}
                  rewriteState={rewriteBySentence[x.sentence]}
                  onRewrite={() => rewriteSentence(x.sentence, "plain_english")}
                />
              ))}
            </div>
          </div>

          {/* All Sentences */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>All Sentences (sorted by risk)</div>
            <div style={styles.list}>
              {topShown.map((x, idx) => (
                <SentenceCard
                  key={`all-${idx}`}
                  sentence={x.sentence}
                  score={x.score}
                  rewriteState={rewriteBySentence[x.sentence]}
                  onRewrite={() => rewriteSentence(x.sentence, "plain_english")}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={styles.placeholder}>
          Upload a PDF and click <b>Analyze PDF</b>.
        </div>
      )}

      <div style={styles.footer}>
        <div style={styles.footerLine}>
          Backend endpoints: <code>/</code>, <code>/health</code>, <code>/analyze</code>,{" "}
          <code>/rewrite</code>
        </div>
      </div>
    </div>
  );
}

function SentenceCard({ sentence, score, onRewrite, rewriteState }) {
  const loading = !!rewriteState?.loading;
  const err = rewriteState?.error || "";
  const out = rewriteState?.output || "";

  return (
    <div style={styles.sentenceCard}>
      <div style={styles.sentenceHeader}>
        <span style={styles.scoreBadge}>Score: {score ?? 0}</span>

        <button
          onClick={onRewrite}
          disabled={loading}
          style={{ ...styles.secondaryBtn, ...(loading ? styles.btnDisabled : {}) }}
          title="Rewrite into plain English (LLM)"
        >
          {loading ? "Rewriting…" : "Rewrite (plain English)"}
        </button>
      </div>

      <div style={styles.sentenceText}>{sentence}</div>

      {err ? <div style={styles.rewriteError}>{err}</div> : null}
      {out ? (
        <div style={styles.rewriteBox}>
          <div style={styles.rewriteLabel}>Plain-English rewrite</div>
          <div style={styles.rewriteText}>{out}</div>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  page: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    padding: 24,
    maxWidth: 1200,
    margin: "0 auto",
    color: "#111",
  },
  headerRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { fontSize: 44, fontWeight: 800, lineHeight: 1.1 },
  subtitle: { marginTop: 8, fontSize: 16, color: "#555" },

  toolbar: {
    marginTop: 18,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  fileInput: { padding: 8 },

  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  secondaryBtn: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  btnDisabled: { opacity: 0.6, cursor: "not-allowed" },

  pillRow: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  pill: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #ddd",
    background: "#f7f7f7",
    fontSize: 13,
  },
  pillGreen: { background: "#e9f8ee", border: "1px solid #bfe7cd" },
  pillRed: { background: "#fdecec", border: "1px solid #f2b8b8" },
  pillGray: { background: "#f4f4f4", border: "1px solid #e0e0e0" },

  apiBox: {
    marginTop: 14,
    padding: 14,
    border: "1px solid #eee",
    borderRadius: 14,
    background: "#fafafa",
  },
  apiBoxLabel: { fontWeight: 800, marginBottom: 6 },
  apiInput: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 14,
  },
  apiHint: { marginTop: 8, fontSize: 12, color: "#666" },

  error: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: "#fdecec",
    border: "1px solid #f2b8b8",
    color: "#7a1f1f",
    fontWeight: 700,
  },

  grid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  card: {
    border: "1px solid #eee",
    borderRadius: 16,
    padding: 16,
    background: "#fff",
    boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
  },
  cardTitle: { fontWeight: 900, marginBottom: 12, fontSize: 16 },

  metricLine: { marginBottom: 8, fontSize: 14 },

  filterRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  filterLabel: { width: 140, fontWeight: 800, fontSize: 14 },
  range: { flex: 1, minWidth: 180 },
  number: {
    width: 100,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 14,
  },
  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #ddd",
    background: "#f7f7f7",
    fontSize: 13,
    fontWeight: 800,
  },
  smallNote: { marginTop: 6, color: "#666", fontSize: 13, lineHeight: 1.35 },

  list: { display: "flex", flexDirection: "column", gap: 12 },

  sentenceCard: {
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 14,
    background: "#fff",
  },
  sentenceHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  scoreBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #f0d9a8",
    background: "#fff6db",
    fontSize: 13,
    fontWeight: 900,
  },
  sentenceText: { fontSize: 15, lineHeight: 1.45, whiteSpace: "pre-wrap" },

  rewriteBox: {
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    background: "#f7fbff",
    border: "1px solid #d8eaff",
  },
  rewriteLabel: { fontWeight: 900, marginBottom: 6, fontSize: 13 },
  rewriteText: { fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" },
  rewriteError: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    background: "#fdecec",
    border: "1px solid #f2b8b8",
    color: "#7a1f1f",
    fontWeight: 800,
    fontSize: 13,
    whiteSpace: "pre-wrap",
  },

  placeholder: {
    marginTop: 24,
    padding: 16,
    border: "1px dashed #ddd",
    borderRadius: 16,
    color: "#666",
    background: "#fafafa",
  },

  footer: { marginTop: 18, color: "#777", fontSize: 12 },
  footerLine: { marginTop: 6 },
};