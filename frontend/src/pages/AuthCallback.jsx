import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    const sessionId = match ? decodeURIComponent(match[1]) : null;
    if (!sessionId) { navigate("/ingresar"); return; }
    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id: sessionId });
        setSession(data.token, data.user);
        window.history.replaceState(null, "", "/mi-archivo");
        navigate("/mi-archivo");
      } catch {
        navigate("/ingresar");
      }
    })();
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <span className="dossier-label text-[#6E675E] animate-pulse">ingresando al archivo…</span>
    </div>
  );
}
