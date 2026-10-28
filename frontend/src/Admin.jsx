import { useEffect, useState } from "react";
import { api } from "./api";

export default function Admin({ onBack }) {
  const [cases, setCases] = useState([]);
  const [sel, setSel] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ case_number: "", title: "", court: "" });
  const [busy, setBusy] = useState(false);

  const load = () => api.admin.cases().then(setCases).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const createCase = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const c = await api.admin.createCase(form);
      setForm({ case_number: "", title: "", court: "" });
      await load();
      setSel(c);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteCase = async (c) => {
    if (!window.confirm(`Delete case ${c.case_number} with all its documents and enrollments?`)) return;
    await api.admin.deleteCase(c.id).catch((e) => setError(e.message));
    setSel(null);
    load();
  };

  return (
    <div className="admin-layout">
      {/* Top Navbar */}
      <header className="app-navbar">
        <div className="nav-brand">
          <span className="nav-brand-title">Administration</span>
          <span className="nav-badge">Case Management</span>
        </div>
        <button className="secondary" onClick={onBack}>
          Back to Workspace
        </button>
      </header>

      {/* Case Creation & List Sidebar */}
      <aside className="column-sidebar" style={{ width: "320px" }}>
        <div className="sidebar-header">
          <span className="sidebar-title">Register New Case</span>
        </div>
        <div style={{ padding: "16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <form style={{ display: "flex", flexDirection: "column", gap: "10px" }} onSubmit={createCase}>
            <input
              placeholder="Case Number (e.g. OS/142/2026)"
              value={form.case_number}
              onChange={(e) => setForm({ ...form, case_number: e.target.value })}
              required
            />
            <input
              placeholder="Case Title (e.g. A vs B)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <input
              placeholder="Court Jurisdiction (optional)"
              value={form.court}
              onChange={(e) => setForm({ ...form, court: e.target.value })}
            />
            <button type="submit" disabled={busy}>
              {busy ? "Registering…" : "Create Case"}
            </button>
          </form>
        </div>

        <div className="sidebar-header">
          <span className="sidebar-title">All Cases</span>
          <span className="sidebar-count">{cases.length}</span>
        </div>
        <div className="sidebar-content">
          {cases.map((c) => (
            <button
              key={c.id}
              className={`list-item ${sel?.id === c.id ? "active" : ""}`}
              onClick={() => setSel(c)}
            >
              <span className="item-badge">{c.case_number}</span>
              <span className="item-subtext">{c.title}</span>
              {c.court && <span className="item-meta">{c.court}</span>}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Admin Case Details */}
      <main className="doc-panel">
        {error && <div className="error">{error}</div>}

        {!sel ? (
          <div className="empty-state" style={{ height: "60vh" }}>
            <h3 style={{ fontWeight: 600 }}>Select a Case to Manage</h3>
            <p className="dim" style={{ maxWidth: "380px" }}>
              Upload court orders, pleadings, or affidavits and enroll authorized advocates by email.
            </p>
          </div>
        ) : (
          <CasePanel key={sel.id} c={sel} onDelete={() => deleteCase(sel)} />
        )}
      </main>
    </div>
  );
}

function CasePanel({ c, onDelete }) {
  const [tab, setTab] = useState("docs");
  return (
    <>
      <div className="card doc-header-card" style={{ marginBottom: "16px" }}>
        <div>
          <span className="dim" style={{ fontSize: "12px", textTransform: "uppercase" }}>
            Case Docket
          </span>
          <h2 className="doc-main-title">{c.case_number}</h2>
          <span className="muted" style={{ fontSize: "14px" }}>
            {c.title} {c.court ? `· ${c.court}` : ""}
          </span>
        </div>
        <button className="danger" onClick={onDelete}>
          Delete Case
        </button>
      </div>

      <div className="tabs-bar">
        <button
          className={`tab-btn ${tab === "docs" ? "active" : ""}`}
          onClick={() => setTab("docs")}
        >
          Documents
        </button>
        <button
          className={`tab-btn ${tab === "users" ? "active" : ""}`}
          onClick={() => setTab("users")}
        >
          Enrolled Parties
        </button>
      </div>

      {tab === "docs" ? <Documents caseId={c.id} /> : <Enrollments caseId={c.id} />}
    </>
  );
}

function Documents({ caseId }) {
  const [docs, setDocs] = useState([]);
  const [languages, setLanguages] = useState({ en: "English" });
  const [form, setForm] = useState({ title: "", language: "en", content: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.admin.documents(caseId).then(setDocs).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api.languages().then(setLanguages).catch(() => {});
  }, [caseId]);

  const onFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setError("");
    setBusy(true);
    try {
      const { text } = await api.admin.extractText(f);
      setForm((x) => ({ ...x, content: text, title: x.title || f.name.replace(/\.[^.]+$/, "") }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const add = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.admin.addDocument(caseId, form);
      setForm({ title: "", language: "en", content: "" });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete "${d.title}"?`)) return;
    await api.admin.deleteDocument(d.id).catch((e) => setError(e.message));
    load();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {error && <div className="error">{error}</div>}

      <form className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "14px" }} onSubmit={add}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "16px", margin: 0 }}>Add New Document</h3>
          <span className="dim" style={{ fontSize: "12px" }}>Text extraction available for PDF uploads</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: "12px" }}>
          <input
            placeholder="Document Title (e.g. Interim Injunction Order)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
            {Object.entries(languages).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div style={{ background: "rgba(0,0,0,0.02)", border: "1px dashed var(--border-subtle)", padding: "12px", borderRadius: "var(--radius-sm)" }}>
          <label style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>Upload PDF or TXT file:</span>
            <input type="file" accept=".pdf,.txt" onChange={onFile} style={{ width: "auto" }} />
          </label>
        </div>

        <textarea
          rows={7}
          placeholder="Or paste legal text here…"
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          required
        />

        <button type="submit" disabled={busy} style={{ alignSelf: "flex-start" }}>
          {busy ? "Processing…" : "Save Document"}
        </button>
      </form>

      <div>
        <h3 style={{ fontSize: "15px", color: "var(--text-muted)", marginBottom: "12px" }}>
          Existing Documents ({docs.length})
        </h3>
        {docs.length === 0 ? (
          <div className="card dim" style={{ textAlign: "center", padding: "20px" }}>
            No documents filed under this case yet.
          </div>
        ) : (
          docs.map((d) => (
            <div
              key={d.id}
              className="card"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}
            >
              <div>
                <strong style={{ display: "block" }}>{d.title}</strong>
                <span className="dim" style={{ fontSize: "12px" }}>
                  Language: {languages[d.language] || d.language} · Filed: {new Date(d.created_at).toLocaleDateString()}
                </span>
              </div>
              <button className="danger" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => remove(d)}>
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Enrollments({ caseId }) {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.admin.enrollments(caseId).then(setUsers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [caseId]);

  const add = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.admin.enroll(caseId, email);
      setEmail("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Unenroll user ${u.email}?`)) return;
    await api.admin.unenroll(caseId, u.id).catch((e) => setError(e.message));
    load();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <form className="glass-card" style={{ display: "flex", gap: "12px", alignItems: "center" }} onSubmit={add}>
        <input
          type="email"
          placeholder="Registered advocate or litigant email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" disabled={busy} style={{ whiteSpace: "nowrap" }}>
          {busy ? "Enrolling…" : "Enroll"}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      <div>
        <h3 style={{ fontSize: "15px", color: "var(--text-muted)", marginBottom: "12px" }}>
          Authorized Parties ({users.length})
        </h3>
        {users.length === 0 ? (
          <div className="card dim" style={{ textAlign: "center", padding: "20px" }}>
            No users enrolled yet. Only enrolled users can view this case.
          </div>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="card"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}
            >
              <div>
                <strong style={{ display: "block" }}>{u.full_name}</strong>
                <span className="dim" style={{ fontSize: "12px" }}>{u.email}</span>
              </div>
              <button className="danger" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => remove(u)}>
                Revoke Access
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
