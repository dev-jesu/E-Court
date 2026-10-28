import { useState, useEffect } from "react";
import { api } from "./api";

const QUOTES = [
  {
    text: "Justice delayed is justice denied.",
    author: "William E. Gladstone",
  },
  {
    text: "The law is reason, free from passion.",
    author: "Aristotle",
  },
  {
    text: "Injustice anywhere is a threat to justice everywhere.",
    author: "Martin Luther King Jr.",
  },
  {
    text: "The safety of the people shall be the highest law.",
    author: "Marcus Tullius Cicero",
  },
  {
    text: "Where law ends, tyranny begins.",
    author: "John Locke",
  },
  {
    text: "Law is order, and good law is good order.",
    author: "Aristotle",
  },
];

export default function Login({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [quoteFade, setQuoteFade] = useState(true);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteFade(false);
      setTimeout(() => {
        setQuoteIdx((prev) => (prev + 1) % QUOTES.length);
        setQuoteFade(true);
      }, 500);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res =
        mode === "login"
          ? await api.login({ email: form.email, password: form.password })
          : await api.register(form);
      await onAuth(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-split">
      {/* Left Panel */}
      <div className="login-left">
        <div className="login-left-overlay" />

        <div className="login-left-content">
          <div className="login-left-branding">
            <div className="login-left-rule" />
            <h2 className="login-left-title">E-Court Intelligence</h2>
            <p className="login-left-tagline">
              Court Document Summarisation Portal
            </p>
          </div>

          <div className={`login-quote-block ${quoteFade ? "visible" : ""}`}>
            <blockquote className="login-quote-text">
              &ldquo;{QUOTES[quoteIdx].text}&rdquo;
            </blockquote>
            <cite className="login-quote-author">
              — {QUOTES[quoteIdx].author}
            </cite>
          </div>

          <p className="login-left-footnote">
            Secure access for advocates and litigants
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="login-right">
        <div className="login-form-container">
          <div className="login-form-header">
            <h1>
              {mode === "login" ? "Sign In" : "Create Account"}
            </h1>
            <p className="muted">
              {mode === "login"
                ? "Access your enrolled proceedings and case summaries"
                : "Register as a litigant or advocate"}
            </p>
          </div>

          <form className="login-form" onSubmit={submit}>
            {mode === "register" && (
              <div className="form-group">
                <label>Full Name</label>
                <input
                  placeholder="Your full name"
                  value={form.full_name}
                  onChange={set("full_name")}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={set("email")}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={set("password")}
                required
              />
            </div>

            {error && <div className="error">{error}</div>}

            <button type="submit" className="login-submit-btn" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                ? "Sign In"
                : "Create Account"}
            </button>

            <div className="login-switch">
              <button
                type="button"
                className="link"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError("");
                }}
              >
                {mode === "login"
                  ? "Need an account? Register"
                  : "Already have an account? Sign In"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
