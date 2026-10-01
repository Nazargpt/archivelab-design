import React from "react";
import { Link } from "react-router-dom";
import { formatARS } from "@/lib/api";

export const ProductCard = ({ p, index = 0 }) => {
  const sold = p.available_total <= 0;
  return (
    <Link
      to={`/pieza-expediente/${p.id}`}
      data-testid={`product-card-${p.id}`}
      className="group block museum-frame hover-lift fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="img-zoom relative aspect-[3/4] bg-[#161616] overflow-hidden">
        {p.images?.[0] ? (
          <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#4A453F] dossier-label">sin imagen</div>
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          {p.vip && <span className="dossier-label bg-[#9E2A2B] text-white px-2 py-1">VIP</span>}
          {sold ? (
            <span className="dossier-label bg-black/70 text-[#A39B8E] px-2 py-1 border border-[#2A2A2A]">agotó archivo</span>
          ) : (
            <span className="dossier-label bg-[#1C241D] text-[#72B078] px-2 py-1">libre</span>
          )}
        </div>
        {p.edition_total && (
          <div className="absolute bottom-3 right-3 dossier-label text-[#E6E2DD] bg-black/60 px-2 py-1">ed. {p.edition_total}</div>
        )}
      </div>
      <div className="p-4">
        <div className="dossier-label text-[#6E675E] mb-1">{p.design_code} · {p.edition_name || "Expediente"}</div>
        <h3 className="font-display font-bold uppercase tracking-tight text-[#F5F4F0] text-lg leading-tight group-hover:text-white">{p.name}</h3>
        <div className="mt-2 text-sm">
          {p.price != null ? (
            <span className="text-[#E6E2DD] font-medium">{formatARS(p.price)}</span>
          ) : (
            <span className="text-[#8C857B] italic">Consultar · pieza en desarrollo</span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
