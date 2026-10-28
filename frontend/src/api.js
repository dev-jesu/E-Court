const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const KEY = "ecourt_token";

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => localStorage.setItem(KEY, t);
export const clearToken = () => localStorage.removeItem(KEY);

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && token) onUnauthorized();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data.detail;
    throw new Error(typeof d === "string" ? d : "Something went wrong");
  }
  return data;
}

async function upload(path, file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Upload failed");
  return data;
}

export async function fetchDocumentPdfBlob(docId) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/documents/${docId}/pdf`, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to load PDF");
  }
  return await res.blob();
}

const admin = {
  cases: () => request("/admin/cases"),
  createCase: (b) => request("/admin/cases", { method: "POST", body: b }),
  deleteCase: (id) => request(`/admin/cases/${id}`, { method: "DELETE" }),
  documents: (id) => request(`/admin/cases/${id}/documents`),
  addDocument: (id, b) => request(`/admin/cases/${id}/documents`, { method: "POST", body: b }),
  deleteDocument: (id) => request(`/admin/documents/${id}`, { method: "DELETE" }),
  extractText: (file) => upload("/admin/extract-text", file),
  enrollments: (id) => request(`/admin/cases/${id}/enrollments`),
  enroll: (id, email) => request(`/admin/cases/${id}/enrollments`, { method: "POST", body: { email } }),
  unenroll: (caseId, userId) => request(`/admin/cases/${caseId}/enrollments/${userId}`, { method: "DELETE" }),
};

export const api = {
  admin,
  login: (b) => request("/auth/login", { method: "POST", body: b }),
  register: (b) => request("/auth/register", { method: "POST", body: b }),
  me: () => request("/me"),
  languages: () => request("/languages"),
  cases: () => request("/cases"),
  documents: (caseId) => request(`/cases/${caseId}/documents`),
  document: (id) => request(`/documents/${id}`),
  documentPdfBlob: (id) => fetchDocumentPdfBlob(id),
  summarize: (id, language) =>
    request(`/documents/${id}/summarize`, { method: "POST", body: { language } }),
};
