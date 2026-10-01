import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import api from "@/lib/api";

export default function Certificate() {
  const { code } = useParams();
  const [u, setU] = useState(null);
  useEffect(() => { api.get(`/public/unit/${code}`).then((r) => setU(r.data)).catch(() => {}); }, [code]);
  if (!u) return <div className="py-32 text-center dossier-label text-[#6E675E]">generando ficha…</div>;

  return (
    <div className="px-4 py-10 max-w-2xl mx-auto">
      <div className="flex justify-end mb-4 print:hidden">
        <button onClick={() => window.print()} data-testid="print-certificate" className="btn-ink px-5 py-2.5 dossier-label inline-flex items-center gap-2"><Printer size={14} /> Imprimir ficha</button>
      </div>
      <div id="cert" className="bg-[#0E0E0E] border border-[#2A2A2A] p-10 print:bg-white print:text-black">
        <div className="flex items-baseline gap-1 justify-center">
          <span className="font-display font-extrabold tracking-tight text-3xl">ARCHIVE</span>
          <span className="font-script text-4xl text-[#8C857B]">lab</span>
        </div>
        <div className="dossier-label text-center text-[#8C857B] mt-2">Ficha de pieza de archivo</div>
        <div className="h-px bg-[#2A2A2A] my-6" />
        <h1 className="font-display font-bold uppercase tracking-tight text-2xl text-center">{u.piece_name}</h1>
        <div className="grid grid-cols-2 gap-5 mt-8 text-sm">
          <Row l="Diseño" v={u.design_code} />
          <Row l="Edición" v={u.edition_name} />
          <Row l="Código único" v={u.unit_code} mono />
          <Row l="Ejemplar" v={u.edition_total ? `${u.edition_number} / ${u.edition_total}` : u.edition_number} />
          <Row l="Talle" v={u.size} />
          <Row l="Color" v={u.color} />
          <Row l="Creadora" v={u.creator} />
        </div>
        <div className="mt-10 pt-6 border-t border-[#2A2A2A] text-center">
          <div className="dossier-label text-[#8C857B]">Escaneá el código único en archivelab.design para ver el registro</div>
          <div className="font-mono2 text-xs mt-2">{window.location.origin}/pieza/{u.unit_code}</div>
        </div>
      </div>
    </div>
  );
}
const Row = ({ l, v, mono }) => (
  <div>
    <div className="dossier-label text-[#8C857B] mb-1">{l}</div>
    <div className={mono ? "font-mono2" : "font-display font-semibold"}>{v}</div>
  </div>
);
