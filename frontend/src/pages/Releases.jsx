import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BellRing, CalendarClock } from "lucide-react";
import api from "@/lib/api";
import { WaitlistModal } from "@/components/WaitlistModal";
import { setSeo } from "@/lib/seo";

const BRAND = process.env.REACT_APP_BACKEND_URL;

export default function Releases() {
  const [releases, setReleases] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    setSeo({ title: "Próximas liberaciones", description: "Lo que viene al archivo. Anotate a la lista de espera para acceso anticipado.", path: "/liberaciones" });
    api.get("/releases").then((r) => setReleases(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <section className="relative h-[46vh] min-h-[360px] overflow-hidden">
        <img src={`${BRAND}/brand/img3.jpeg`} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/70 to-[#0A0A0A]/40" />
        <div className="relative z-10 h-full flex flex-col justify-end px-4 sm:px-8 lg:px-16 pb-12">
          <div className="dossier-label text-[#6E675E] mb-3">Lo que viene</div>
          <h1 className="font-display font-extrabold uppercase tracking-tight text-4xl lg:text-6xl text-[#F5F4F0]">Próximas liberaciones</h1>
          <p className="font-script text-2xl text-[#8C857B] mt-3">Acceso anticipado para miembros del archivo.</p>
        </div>
      </section>

      <section className="px-4 sm:px-8 lg:px-16 py-12 lg:py-16">
        {releases.length === 0 ? (
          <p className="py-20 text-center dossier-label text-[#6E675E]">No hay liberaciones anunciadas por ahora.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {releases.map((r, i) => (
              <motion.div key={r.id} data-testid={`release-card-${r.id}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="museum-frame overflow-hidden hover-lift flex flex-col">
                <div className="img-zoom aspect-[16/10] bg-[#161616] overflow-hidden relative">
                  {r.image && <img src={r.image} alt={r.title} className="w-full h-full object-cover" />}
                  <div className="absolute top-3 left-3 dossier-label bg-black/70 text-[#E6E2DD] px-2 py-1 border border-[#2A2A2A] inline-flex items-center gap-1.5"><CalendarClock size={12} /> {r.teaser_date || "Próximamente"}</div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="font-display font-bold uppercase tracking-tight text-xl text-[#F5F4F0]">{r.title}</h3>
                  {r.description && <p className="text-sm text-[#A39B8E] mt-3 leading-relaxed flex-1">{r.description}</p>}
                  <button data-testid={`release-waitlist-${r.id}`} onClick={() => setActive(r)} className="btn-ink mt-5 w-full py-3 dossier-label inline-flex items-center justify-center gap-2">
                    <BellRing size={15} /> Anotarme a la lista
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {active && <WaitlistModal kind="release" refId={active.id} title={active.title} onClose={() => setActive(null)} />}
    </div>
  );
}
