import { useEffect, useState } from "react";
import { api, getToken, setToken, clearToken, setUnauthorizedHandler } from "./api";
import Login from "./Login.jsx";
import Workspace from "./Workspace.jsx";
import Admin from "./Admin.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("workspace");
  const [checking, setChecking] = useState(!!getToken());

  const logout = () => {
    clearToken();
    setUser(null);
    setView("workspace");
  };

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return;
    api.me().then(setUser).catch(logout).finally(() => setChecking(false));
  }, []);

  const onAuth = async (tokenResponse) => {
    setToken(tokenResponse.access_token);
    setUser(await api.me());
  };

  if (checking) return <p className="center muted">Loading…</p>;
  if (!user) return <Login onAuth={onAuth} />;
  if (view === "admin" && user.role === "admin")
    return <Admin onBack={() => setView("workspace")} />;
  return <Workspace user={user} onLogout={logout} onAdmin={() => setView("admin")} />;
}
