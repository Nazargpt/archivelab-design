import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { CATEGORIES } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { WaitlistModal } from "@/components/WaitlistModal";

const AVAIL = [
  { key: "", label: "Todo" },
  { key: "libre", label: "Libre" },
  { key: "agotado", label: "Agotó archivo" },
];

export default function Archive() {
  const [sp, setSp] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waitlist, setWaitlist] = useState(null);
  const cat = sp.get("cat") || "";
  const avail = sp.get("avail") || "";
  const size = sp.get("size") || "";
  const view = sp.get("view") || "disponible";
  const historic = view === "historico";

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (cat) params.category = cat;
    if (historic) {
      params.historic = true;
    } else {
      if (avail) params.availability = avail;
      if (size) params.size = size;
    }
    api.get("/products", { params }).then((r) => {
      setProducts(r.data.filter((p) => !p.vip));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [cat, avail, size, historic]);

  const setFilter = (k, v) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    setSp(n);
  };

  return (
    <div className="px-4 sm:px-8 lg:px-16 py-12 lg:py-16">
      <div className="mb-8">
        <div className="dossier-label text-[#6E675E] mb-3">{historic ? "Ediciones agotadas" : "El archivo disponible"}</div>
        <h1 className="font-display font-extrabold uppercase tracking-tight text-4xl lg:text-6xl text-[#F5F4F0]">Archivo</h1>
      </div>

      <div className="flex gap-2 mb-6">
        <button data-testid="view-disponible" onClick={() => setFilter("view", "")} className={`dossier-label px-5 py-2.5 border-b-2 transition-colors ${!historic ? "border-[#E6E2DD] text-[#F5F4F0]" : "border-transparent text-[#6E675E] hover:text-[#A39B8E]"}`}>Disponible</button>
        <button data-testid="view-historico" onClick={() => setFilter("view", "historico")} className={`dossier-label px-5 py-2.5 border-b-2 transition-colors ${historic ? "border-[#E6E2DD] text-[#F5F4F0]" : "border-transparent text-[#6E675E] hover:text-[#A39B8E]"}`}>Histórico</button>
      </div>

      <div className="flex flex-col gap-4 mb-10 border-y border-[#161616] py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="dossier-label text-[#6E675E] mr-2">Categoría</span>
          <button data-testid="filter-category-all" onClick={() => setFilter("cat", "")} className={`dossier-label px-3 py-1.5 border transition-colors ${!cat ? "border-[#E6E2DD] text-[#F5F4F0]" : "border-[#2A2A2A] text-[#8C857B] hover:border-[#555]"}`}>Todas</button>
          {CATEGORIES.map((c) => (
            <button key={c.key} data-testid={`filter-category-${c.key}`} onClick={() => setFilter("cat", c.key)} className={`dossier-label px-3 py-1.5 border transition-colors ${cat === c.key ? "border-[#E6E2DD] text-[#F5F4F0]" : "border-[#2A2A2A] text-[#8C857B] hover:border-[#555]"}`}>{c.label}</button>
          ))}
        </div>
        {!historic && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="dossier-label text-[#6E675E] mr-2">Disponibilidad</span>
            {AVAIL.map((a) => (
              <button key={a.key} data-testid={`filter-avail-${a.key || "all"}`} onClick={() => setFilter("avail", a.key)} className={`dossier-label px-3 py-1.5 border transition-colors ${avail === a.key ? "border-[#E6E2DD] text-[#F5F4F0]" : "border-[#2A2A2A] text-[#8C857B] hover:border-[#555]"}`}>{a.label}</button>
            ))}
            <span className="dossier-label text-[#6E675E] ml-4 mr-2">Talle</span>
            {["1", "2", "3", "Único"].map((s) => (
              <button key={s} data-testid={`filter-size-${s}`} onClick={() => setFilter("size", size === s ? "" : s)} className={`dossier-label px-3 py-1.5 border transition-colors ${size === s ? "border-[#E6E2DD] text-[#F5F4F0]" : "border-[#2A2A2A] text-[#8C857B] hover:border-[#555]"}`}>{s}</button>
            ))}
          </div>
        )}
      </div>

      {historic && !loading && products.length > 0 && (
        <p className="text-sm text-[#8C857B] mb-6 -mt-4">Estas ediciones ya no están disponibles. Quedan en el archivo como registro. Abrí el expediente para ver su historia, o anotate para enterarte si vuelve algo.</p>
      )}

      {loading ? (
        <div className="py-24 text-center dossier-label text-[#6E675E] animate-pulse">cargando archivo…</div>
      ) : products.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-display uppercase tracking-tight text-2xl text-[#8C857B]">{historic ? "Todavía no hay ediciones en el histórico" : "No hay piezas con esos filtros"}</p>
          <p className="text-[#6E675E] text-sm mt-2">{historic ? "Cuando una edición agote, va a aparecer acá." : "Probá cambiar la categoría o la disponibilidad."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {products.map((p, i) => (
            historic ? (
              <div key={p.id} data-testid={`historic-card-${p.id}`} className="museum-frame overflow-hidden flex flex-col fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <a href={`/pieza-expediente/${p.id}`} className="img-zoom relative aspect-[3/4] bg-[#161616] overflow-hidden block">
                  {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover opacity-80" loading="lazy" />}
                  <span className="absolute top-3 left-3 dossier-label bg-black/70 text-[#A39B8E] px-2 py-1 border border-[#2A2A2A]">agotó archivo</span>
                </a>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="dossier-label text-[#6E675E] mb-1">{p.design_code} · {p.edition_name || "Expediente"}</div>
                  <h3 className="font-display font-bold uppercase tracking-tight text-[#F5F4F0] text-lg leading-tight">{p.name}</h3>
                  <button data-testid={`historic-waitlist-${p.id}`} onClick={() => setWaitlist(p)} className="btn-outline-ink mt-4 py-2.5 dossier-label">Avisame si vuelve</button>
                </div>
              </div>
            ) : <ProductCard key={p.id} p={p} index={i} />
          ))}
        </div>
      )}

      {waitlist && <WaitlistModal kind="product" refId={waitlist.id} title={waitlist.name} onClose={() => setWaitlist(null)} />}
    </div>
  );
}
