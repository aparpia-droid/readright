import React, { useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

function Pill({ children, tone = "neutral" }) {
  const bg =
    tone === "error"
      ? "#fee2e2"
      : tone === "success"
      ? "#dcfce7"
      : tone === "warn"
      ? "#fef3c7"
      : "#e5e7eb";
  const fg =
    tone === "error"
      ? "#991b1b"
      : tone === "success"
      ? "#166534"
      : tone === "warn"
      ? "#92400e"
      : "#111827";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 600,
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </span>
  );
}

function Card({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "white",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | analyzing | done | error
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const hotspotText = useMemo(() => {
    if (!result?.top_risk_sentences) return "";
    return result.top_risk_sentences.map((x) => x.sentence).join("\n\n");
  }, [result]);

  async function analyze() {
    if (!file) return;

    setStatus("analyzing");
    setError("");
    setResult(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        setStatus("error");
        setError(`Backend error (${res.status}): ${text}`);
        return;
      }

      const data = await res.json();

      // DEBUG: confirm the UI is receiving the JSON
      console.log("API response:", data);

      setResult(data);
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError("Could not reach backend. Is uvicorn running on :8000?");
    }
  }

  const gradeLevel =
    result?.grade_level !== undefined && result?.grade_level !== null
      ? Number(result.grade_level).toFixed(2)
      : null;

  const readingTime =
    result?.reading_time_minutes !== undefined &&
    result?.reading_time_minutes !== null
      ? Number(result.reading_time_minutes).toFixed(2)
      : null;

  const top = Array.isArray(result?.top_risk_sentences)
    ? result.top_risk_sentences
    : [];

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <div
        style={{
          maxWidth: 980,
          margin: "30px auto",
          padding: "0 18px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -0.5 }}>
            ReadRight
          </div>
          <div style={{ color: "#6b7280", fontWeight: 600 }}>
            Upload a PDF → find confusing hotspots
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              setStatus("idle");
              setError("");
              setResult(null);
            }}
          />

          <button
            onClick={analyze}
            disabled={!file || status === "analyzing"}
            style={{
              padding: "9px 14px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: status === "analyzing" ? "#111827" : "#111827",
              color: "white",
              fontWeight: 800,
              cursor: !file || status === "analyzing" ? "not-allowed" : "pointer",
              opacity: !file || status === "analyzing" ? 0.55 : 1,
            }}
          >
            {status === "analyzing" ? "Analyzing..." : "Analyze PDF"}
          </button>

          {file && <Pill tone="neutral">{file.name}</Pill>}

          {status === "done" && <Pill tone="success">Done</Pill>}
          {status === "error" && <Pill tone="error">Error</Pill>}
        </div>

        {error && (
          <div style={{ color: "#b91c1c", fontWeight: 700, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginTop: 16,
          }}
        >
          <Card title="Metrics">
            {result ? (
              <div style={{ display: "grid", gap: 8, fontWeight: 700 }}>
                <div>
                  Readability Grade Level:{" "}
                  <span style={{ color: "#111827" }}>{gradeLevel}</span>
                </div>
                <div>
                  Estimated Reading Time (minutes):{" "}
                  <span style={{ color: "#111827" }}>{readingTime}</span>
                </div>
              </div>
            ) : (
              <div style={{ color: "#6b7280", fontWeight: 600 }}>
                Upload a PDF and click Analyze.
              </div>
            )}
          </Card>

          <Card title="Top Hotspots">
            {top.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {top.slice(0, 5).map((s, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <Pill tone={s.score >= 6 ? "warn" : "neutral"}>
                        Risk Score: {s.score}
                      </Pill>
                    </div>
                    <div style={{ lineHeight: 1.35 }}>{s.sentence}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#6b7280", fontWeight: 600 }}>
                No hotspots yet.
              </div>
            )}
          </Card>
        </div>

        <div style={{ marginTop: 16 }}>
          <Card title="Hotspot Text (used for rewrite step later)">
            <textarea
              value={hotspotText}
              readOnly
              placeholder="Hotspot sentences will appear here after analysis."
              style={{
                width: "100%",
                minHeight: 220,
                resize: "vertical",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas",
                fontSize: 13,
              }}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}