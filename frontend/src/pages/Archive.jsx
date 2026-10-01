import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { CATEGORIES } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

const AVAIL = [
  { key: "", label: "Todo" },
  { key: "libre", label: "Libre" },
  { key: "agotado", label: "Agotó archivo" },
];

export default function Archive() {
  const [sp, setSp] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const cat = sp.get("cat") || "";
  const avail = sp.get("avail") || "";
  const size = sp.get("size") || "";

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (cat) params.category = cat;
    if (avail) params.availability = avail;
    if (size) params.size = size;
    api.get("/products", { params }).then((r) => {
      setProducts(r.data.filter((p) => !p.vip));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [cat, avail, size]);

  const setFilter = (k, v) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    setSp(n);
  };

  return (
    <div className="px-4 sm:px-8 lg:px-16 py-12 lg:py-16">
      <div className="mb-10">
        <div className="dossier-label text-[#6E675E] mb-3">El archivo disponible</div>
        <h1 className="font-display font-extrabold uppercase tracking-tight text-4xl lg:text-6xl text-[#F5F4F0]">Archivo</h1>
      </div>

      <div className="flex flex-col gap-4 mb-10 border-y border-[#161616] py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="dossier-label text-[#6E675E] mr-2">Categoría</span>
          <button data-testid="filter-category-all" onClick={() => setFilter("cat", "")} className={`dossier-label px-3 py-1.5 border transition-colors ${!cat ? "border-[#E6E2DD] text-[#F5F4F0]" : "border-[#2A2A2A] text-[#8C857B] hover:border-[#555]"}`}>Todas</button>
          {CATEGORIES.map((c) => (
            <button key={c.key} data-testid={`filter-category-${c.key}`} onClick={() => setFilter("cat", c.key)} className={`dossier-label px-3 py-1.5 border transition-colors ${cat === c.key ? "border-[#E6E2DD] text-[#F5F4F0]" : "border-[#2A2A2A] text-[#8C857B] hover:border-[#555]"}`}>{c.label}</button>
          ))}
        </div>
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
      </div>

      {loading ? (
        <div className="py-24 text-center dossier-label text-[#6E675E] animate-pulse">cargando archivo…</div>
      ) : products.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-display uppercase tracking-tight text-2xl text-[#8C857B]">No hay piezas con esos filtros</p>
          <p className="text-[#6E675E] text-sm mt-2">Probá cambiar la categoría o la disponibilidad.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {products.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
        </div>
      )}
    </div>
  );
}
