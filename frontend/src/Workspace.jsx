import { useEffect, useState } from "react";
import { api } from "./api";

export default function Workspace({ user, onLogout, onAdmin }) {
  const [cases, setCases] = useState([]);
  const [languages, setLanguages] = useState({ en: "English" });
  const [activeCase, setActiveCase] = useState(null);
  const [docs, setDocs] = useState([]);
  const [doc, setDoc] = useState(null);
  const [lang, setLang] = useState("en");
  const [summary, setSummary] = useState("");
  const [cachedStatus, setCachedStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // PDF Viewer Modal State
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    api.cases().then(setCases).catch((e) => setError(e.message));
    api.languages().then(setLanguages).catch(() => {});
  }, []);

  const openCase = async (c) => {
    setActiveCase(c);
    setDoc(null);
    setSummary("");
    setCachedStatus(false);
    setError("");
    closePdfModal();
    try {
      const caseDocs = await api.documents(c.id);
      setDocs(caseDocs);
      if (caseDocs.length > 0) {
        openDoc(caseDocs[0]);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const openDoc = async (d) => {
    setSummary("");
    setCachedStatus(false);
    setError("");
    closePdfModal();
    try {
      const fullDoc = await api.document(d.id);
      setDoc(fullDoc);
    } catch (e) {
      setError(e.message);
    }
  };

  const viewPdf = async () => {
    if (!doc) return;
    setPdfLoading(true);
    setError("");
    try {
      const blob = await api.documentPdfBlob(doc.id);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setPdfModalOpen(true);
    } catch (e) {
      setError(e.message || "Could not load PDF document");
    } finally {
      setPdfLoading(false);
    }
  };

  const closePdfModal = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setPdfModalOpen(false);
  };

  const runSummary = async () => {
    if (!doc) return;
    setLoading(true);
    setError("");
    setSummary("");
    try {
      const res = await api.summarize(doc.id, lang);
      setSummary(res.summary);
      setCachedStatus(!!res.cached);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="workspace-layout">
      {/* Top Navbar */}
      <header className="app-navbar">
        <div className="nav-brand">
          <span className="nav-brand-title">E-Court Workspace</span>
          <span className="nav-badge">Proceedings</span>
        </div>

        <div className="nav-user-actions">
          {user.role === "admin" && (
            <button className="secondary" style={{ padding: "6px 14px", fontSize: "13px" }} onClick={onAdmin}>
              Admin Panel
            </button>
          )}
          <div className="user-profile">
            <div className="user-avatar">{user.full_name.charAt(0).toUpperCase()}</div>
            <span>{user.full_name}</span>
          </div>
          <button className="link" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Cases Sidebar */}
      <aside className="column-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">Enrolled Cases</span>
          <span className="sidebar-count">{cases.length}</span>
        </div>
        <div className="sidebar-content">
          {cases.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">—</span>
              <p className="dim" style={{ fontSize: "13px" }}>No cases enrolled yet.</p>
            </div>
          ) : (
            cases.map((c) => (
              <button
                key={c.id}
                className={`list-item ${activeCase?.id === c.id ? "active" : ""}`}
                onClick={() => openCase(c)}
              >
                <span className="item-badge">{c.case_number}</span>
                <span className="item-subtext">{c.title}</span>
                {c.court && <span className="item-meta">{c.court}</span>}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Documents Sidebar */}
      <aside className="column-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">Case Documents</span>
          <span className="sidebar-count">{docs.length}</span>
        </div>
        <div className="sidebar-content">
          {!activeCase ? (
            <div className="empty-state">
              <span className="empty-icon">—</span>
              <p className="dim" style={{ fontSize: "13px" }}>Select a case to view documents.</p>
            </div>
          ) : docs.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">—</span>
              <p className="dim" style={{ fontSize: "13px" }}>No documents found for this case.</p>
            </div>
          ) : (
            docs.map((d) => (
              <button
                key={d.id}
                className={`list-item ${doc?.id === d.id ? "active" : ""}`}
                onClick={() => openDoc(d)}
              >
                <span style={{ fontWeight: 600, fontSize: "13.5px" }}>{d.title}</span>
                <span className="item-meta">
                  {new Date(d.created_at).toLocaleDateString()} · {languages[d.language] || d.language}
                  {d.file_path && " · PDF"}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Document & Summarizer */}
      <main className="doc-panel">
        {error && <div className="error">{error}</div>}

        {!doc ? (
          <div className="empty-state" style={{ height: "60vh" }}>
            <h3 style={{ fontWeight: 600 }}>Select a document to review</h3>
            <p className="dim" style={{ maxWidth: "380px", fontSize: "14px" }}>
              Choose a case from your enrolled docket, then select a filing to read, view the original PDF, or generate a summary.
            </p>
          </div>
        ) : (
          <>
            <div className="card doc-header-card">
              <div>
                <span className="dim" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Active Document
                </span>
                <h2 className="doc-main-title">{doc.title}</h2>
                <span className="muted" style={{ fontSize: "13px" }}>
                  Case: {activeCase?.case_number} · Filed on {new Date(doc.created_at).toLocaleDateString()}
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span className="success-badge">Verified Filing</span>
                {doc.file_path ? (
                  <button
                    onClick={viewPdf}
                    disabled={pdfLoading}
                    style={{
                      padding: "8px 14px",
                      fontSize: "13px",
                      background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                      boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)"
                    }}
                  >
                    {pdfLoading ? "Loading…" : "View Original PDF"}
                  </button>
                ) : (
                  <span className="dim" style={{ fontSize: "12px" }}>Text-only document</span>
                )}
              </div>
            </div>

            {/* Document Content View */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span className="dim" style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: 700 }}>
                  Document Text
                </span>
                <span className="dim" style={{ fontSize: "12px" }}>
                  {doc.content.length.toLocaleString()} characters
                </span>
              </div>
              <div className="doc-viewer">{doc.content}</div>
            </div>

            {/* Summarizer Action Strip */}
            <div className="action-strip">
              <div>
                <strong style={{ fontSize: "14.5px", display: "block" }}>
                  Document Summarizer
                </strong>
                <span className="muted" style={{ fontSize: "13px" }}>
                  Generate a structured summary in your preferred language
                </span>
              </div>

              <div className="action-controls">
                <select value={lang} onChange={(e) => setLang(e.target.value)}>
                  {Object.entries(languages).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name} ({code.toUpperCase()})
                    </option>
                  ))}
                </select>
                <button onClick={runSummary} disabled={loading}>
                  {loading ? "Generating…" : "Summarize"}
                </button>
              </div>
            </div>

            {/* Summary Output */}
            {summary && (
              <div className="summary-container">
                <div className="summary-header">
                  <div className="summary-heading">
                    <span>Summary — {languages[lang] || lang}</span>
                  </div>
                  {cachedStatus && (
                    <span className="success-badge">Cached</span>
                  )}
                </div>
                <div className="summary-body">{summary}</div>
                <div className="summary-disclaimer">
                  This summary is generated by AI and is not a substitute for professional legal advice.
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* PDF Viewer Modal */}
      {pdfModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={closePdfModal}
        >
          <div
            style={{
              width: "90vw",
              maxWidth: "1100px",
              height: "90vh",
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid #cbd5e1"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
                backgroundColor: "#f8fafc"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <strong style={{ fontSize: "15px", color: "#0f172a" }}>
                  {doc?.title}
                </strong>
                <span className="nav-badge">{activeCase?.case_number}</span>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <a
                  href={pdfUrl}
                  download={`${doc?.title || "Court_Document"}.pdf`}
                  style={{
                    padding: "6px 14px",
                    fontSize: "12px",
                    textDecoration: "none",
                    borderRadius: "6px",
                    background: "#e2e8f0",
                    color: "#334155",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center"
                  }}
                >
                  Download
                </a>
                <button
                  onClick={closePdfModal}
                  style={{
                    padding: "6px 14px",
                    fontSize: "12px",
                    background: "#ef4444",
                    color: "#fff"
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Embedded PDF */}
            <div style={{ flex: 1, backgroundColor: "#525659" }}>
              <iframe
                src={pdfUrl}
                title="PDF Viewer"
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
