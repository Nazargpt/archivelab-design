import React, { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import api, { errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WaitlistModal({ kind, refId, title, onClose }) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [size, setSize] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const endpoint = kind === "release" ? `/releases/${refId}/waitlist` : `/products/${refId}/waitlist`;

  const submit = async () => {
    if (!name || !email) return toast.error("Completá nombre y email");
    if (!consent) return toast.error("Necesitamos tu consentimiento para avisarte");
    setBusy(true);
    try {
      await api.post(endpoint, { name, email, size, consent });
      toast.success("¡Listo! Estás en la lista", { description: "Te avisamos cuando haya novedades." });
      onClose();
    } catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0E0E0E] border border-[#2A2A2A] w-full max-w-md" onClick={(e) => e.stopPropagation()} data-testid="waitlist-modal">
        <div className="flex items-center justify-between p-5 border-b border-[#1C1C1C]">
          <h2 className="font-display font-bold uppercase tracking-tight text-lg text-[#F5F4F0]">Lista de espera</h2>
          <button onClick={onClose} className="text-[#8C857B] hover:text-[#F5F4F0]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="dossier-label text-[#6E675E]">{title}</div>
          <div><Label className="dossier-label text-[#6E675E]">Nombre</Label><Input data-testid="waitlist-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]" /></div>
          <div><Label className="dossier-label text-[#6E675E]">Email</Label><Input data-testid="waitlist-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]" /></div>
          <div><Label className="dossier-label text-[#6E675E]">Talle de interés (opcional)</Label><Input data-testid="waitlist-size" value={size} onChange={(e) => setSize(e.target.value)} className="mt-1.5 bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]" placeholder="1 · 2 · 3 · Único" /></div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input data-testid="waitlist-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#E6E2DD]" />
            <span className="text-xs text-[#8C857B] leading-relaxed">Acepto que me contacten por email para avisarme de novedades sobre esta pieza o liberación. Solo usamos tu dato para eso.</span>
          </label>
          <button data-testid="waitlist-submit" onClick={submit} disabled={busy} className="btn-ink w-full py-3.5 dossier-label disabled:opacity-60">
            {busy ? "Anotándote…" : "Anotarme a la lista"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WaitlistModal;
