import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Calendar, MapPin, Ticket, X } from "lucide-react";
import api, { formatARS, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setSeo } from "@/lib/seo";

const TYPE_LABEL = { desfile: "Desfile", lanzamiento: "Lanzamiento", exposicion: "Exposición", presentacion: "Presentación" };

export default function Events() {
  const [events, setEvents] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    setSeo({ title: "Eventos", description: "Desfiles, lanzamientos y presentaciones de ARCHIVE LAB. Anotate o comprá tu entrada.", path: "/eventos" });
    api.get("/events").then((r) => setEvents(r.data)).catch(() => {});
  }, []);

  return (
    <div className="px-4 sm:px-8 lg:px-16 py-12 lg:py-16">
      <div className="mb-10">
        <div className="dossier-label text-[#6E675E] mb-3">Agenda del archivo</div>
        <h1 className="font-display font-extrabold uppercase tracking-tight text-4xl lg:text-6xl text-[#F5F4F0]">Eventos</h1>
        <p className="text-[#8C857B] mt-3 max-w-xl">Desfiles, lanzamientos y presentaciones. Anotate a los de entrada libre o comprá tu entrada con el mismo pago que las piezas.</p>
      </div>

      {events.length === 0 ? (
        <p className="py-20 text-center dossier-label text-[#6E675E]">Todavía no hay eventos publicados.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {events.map((ev, i) => (
            <motion.div key={ev.id} data-testid={`event-card-${ev.id}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="museum-frame overflow-hidden hover-lift flex flex-col">
              <div className="img-zoom aspect-[16/10] bg-[#161616] overflow-hidden relative">
                {ev.image && <img src={ev.image} alt={ev.title} className="w-full h-full object-cover" />}
                <div className="absolute top-3 left-3 dossier-label bg-black/70 text-[#E6E2DD] px-2 py-1 border border-[#2A2A2A]">{TYPE_LABEL[ev.type] || ev.type}</div>
                {ev.sold_out && <div className="absolute top-3 right-3 dossier-label bg-[#2A1515] text-[#c74446] px-2 py-1">sin cupos</div>}
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="font-display font-bold uppercase tracking-tight text-xl text-[#F5F4F0]">{ev.title}</h3>
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-[#8C857B]">
                  <span className="inline-flex items-center gap-1.5"><Calendar size={13} /> {ev.date || "A confirmar"}</span>
                  <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {ev.location || "A confirmar"}</span>
                </div>
                {ev.description && <p className="text-sm text-[#A39B8E] mt-3 leading-relaxed flex-1">{ev.description}</p>}
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#161616]">
                  <span className="text-sm text-[#E6E2DD]">{ev.price != null ? formatARS(ev.price) : "Entrada libre"}</span>
                  {ev.spots_left != null && <span className="dossier-label text-[#6E675E]">{ev.spots_left} cupos</span>}
                </div>
                <button data-testid={`event-register-${ev.id}`} disabled={ev.sold_out} onClick={() => setActive(ev)}
                  className={`mt-4 w-full py-3 dossier-label inline-flex items-center justify-center gap-2 ${ev.sold_out ? "bg-[#1C1C1C] text-[#555] cursor-not-allowed" : "btn-ink"}`}>
                  <Ticket size={15} /> {ev.sold_out ? "Sin cupos" : ev.price != null ? "Comprar entrada" : "Anotarme"}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {active && <RegisterModal ev={active} onClose={() => setActive(null)} onDone={() => { setActive(null); api.get("/events").then((r) => setEvents(r.data)); }} />}
    </div>
  );
}

function RegisterModal({ ev, onClose, onDone }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [busy, setBusy] = useState(false);
  const paid = ev.price != null;

  const submit = async () => {
    if (!name || !email) return toast.error("Completá nombre y email");
    setBusy(true);
    try {
      const { data } = await api.post(`/events/${ev.id}/register`, { name, email });
      if (data.paid) {
        if (data.demo) navigate(`/checkout/demo/${data.order_id}`);
        else if (data.checkout_url) window.location.href = data.checkout_url;
      } else {
        toast.success("¡Listo! Quedaste anotada", { description: ev.title });
        onDone();
      }
    } catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0E0E0E] border border-[#2A2A2A] w-full max-w-md" onClick={(e) => e.stopPropagation()} data-testid="event-register-modal">
        <div className="flex items-center justify-between p-5 border-b border-[#1C1C1C]">
          <h2 className="font-display font-bold uppercase tracking-tight text-lg text-[#F5F4F0]">{paid ? "Comprar entrada" : "Anotarme"}</h2>
          <button onClick={onClose} className="text-[#8C857B] hover:text-[#F5F4F0]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="dossier-label text-[#6E675E]">{ev.title} · {paid ? formatARS(ev.price) : "entrada libre"}</div>
          <div><Label className="dossier-label text-[#6E675E]">Nombre y apellido</Label><Input data-testid="event-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]" /></div>
          <div><Label className="dossier-label text-[#6E675E]">Email</Label><Input data-testid="event-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]" /></div>
          <button data-testid="event-confirm" onClick={submit} disabled={busy} className="btn-ink w-full py-3.5 dossier-label disabled:opacity-60">
            {busy ? "Procesando…" : paid ? "Pagar entrada con Mercado Pago" : "Confirmar inscripción"}
          </button>
        </div>
      </div>
    </div>
  );
}
