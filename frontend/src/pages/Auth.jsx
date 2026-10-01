import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";

const BRAND = process.env.REACT_APP_BACKEND_URL;

export default function Auth() {
  const { login, register, user } = useAuth();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState(sp.get("modo") === "registro" ? "registro" : "login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) navigate("/mi-archivo"); }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "registro") await register(form.email, form.password, form.name);
      else await login(form.email, form.password);
      toast.success("Bienvenida al archivo");
      navigate("/mi-archivo");
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  };

  const google = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/mi-archivo";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:block relative">
        <img src={`${BRAND}/brand/img2.jpeg`} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent" />
        <div className="absolute bottom-12 left-10">
          <p className="font-script text-4xl text-[#E6E2DD]">Construí tu propio archivo.</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-16">
        <div className="w-full max-w-sm">
          <Logo size="text-2xl" />
          <h1 className="font-display font-extrabold uppercase tracking-tight text-3xl text-[#F5F4F0] mt-8">
            {mode === "registro" ? "Sumate al archivo" : "Ingresá"}
          </h1>
          <p className="text-sm text-[#8C857B] mt-2">Accedé a tus piezas, códigos y a la sección Camila Guerra.</p>

          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            {mode === "registro" && (
              <div>
                <Label className="dossier-label text-[#6E675E]">Nombre</Label>
                <Input data-testid="auth-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2 bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]" />
              </div>
            )}
            <div>
              <Label className="dossier-label text-[#6E675E]">Email</Label>
              <Input data-testid="auth-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]" />
            </div>
            <div>
              <Label className="dossier-label text-[#6E675E]">Contraseña</Label>
              <Input data-testid="auth-password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-2 bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]" />
            </div>
            <button data-testid="auth-submit" disabled={busy} className="btn-ink py-4 dossier-label mt-2 disabled:opacity-60">
              {busy ? "Procesando…" : mode === "registro" ? "Crear cuenta" : "Ingresar"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-[#1C1C1C]" />
            <span className="dossier-label text-[#4A453F]">o</span>
            <div className="h-px flex-1 bg-[#1C1C1C]" />
          </div>
          <button data-testid="google-login" onClick={google} className="btn-outline-ink w-full py-3.5 dossier-label">Continuar con Google</button>

          <p className="text-sm text-[#8C857B] mt-6 text-center">
            {mode === "registro" ? "¿Ya tenés cuenta?" : "¿Primera vez?"}{" "}
            <button data-testid="auth-toggle" onClick={() => setMode(mode === "registro" ? "login" : "registro")} className="text-[#E6E2DD] hover:underline">
              {mode === "registro" ? "Ingresá" : "Creá tu cuenta"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
