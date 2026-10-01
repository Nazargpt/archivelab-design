import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import api from "@/lib/api";
import { Logo } from "@/components/Logo";

const STATUS = {
  disponible: { t: "En el archivo (libre)", c: "text-[#72B078]" },
  reservada: { t: "Reservada", c: "text-[#A39B8E]" },
  vendida: { t: "Adquirida", c: "text-[#E6E2DD]" },
  retirada: { t: "Retirada del archivo", c: "text-[#c74446]" },
};

export default function PublicPiece() {
  const { code } = useParams();
  const [u, setU] = useState(null);
  const [nf, setNf] = useState(false);

  useEffect(() => {
    api.get(`/public/unit/${code}`).then((r) => setU(r.data)).catch(() => setNf(true));
  }, [code]);

  if (nf) return (
    <div className="py-32 text-center">
      <p className="dossier-label text-[#8C857B]">Código no encontrado en el archivo</p>
      <Link to="/" className="dossier-label text-[#E6E2DD] mt-4 inline-block">Volver al inicio</Link>
    </div>
  );
  if (!u) return <div className="py-32 text-center dossier-label text-[#6E675E] animate-pulse">consultando el archivo…</div>;

  const st = STATUS[u.status] || STATUS.disponible;

  return (
    <div className="px-4 py-12 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <Logo size="text-3xl" />
        <div className="dossier-label text-[#6E675E] mt-4">Registro de pieza de archivo</div>
      </div>

      <div className="museum-frame overflow-hidden">
        {u.images?.[0] && (
          <div className="aspect-[16/9] bg-[#161616] overflow-hidden">
            <img src={u.images[0]} alt={u.piece_name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6 lg:p-10">
          <div className="dossier-label text-[#6E675E]">{u.design_code} · {u.edition_name}</div>
          <h1 className="font-display font-extrabold uppercase tracking-tight text-3xl lg:text-4xl text-[#F5F4F0] mt-1">{u.piece_name}</h1>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <Cell label="Código único" value={u.unit_code} mono />
            <Cell label="Nº de ejemplar" value={u.edition_total ? `${u.edition_number} de ${u.edition_total}` : u.edition_number} />
            <Cell label="Talle" value={u.size} />
            <Cell label="Color" value={u.color} />
            <Cell label="Estado" valueNode={<span className={st.c}>{st.t}</span>} />
            <Cell label="Creadora" value={u.creator} />
          </div>

          {u.concept && <Block label="Concepto" value={u.concept} />}
          {u.interventions && <Block label="Intervenciones" value={u.interventions} />}
          {u.materials && <Block label="Materiales" value={u.materials} />}
          {u.care && <Block label="Cuidados" value={u.care} />}

          <div className="flex items-start gap-3 mt-8 p-4 bg-[#0E0E0E] border border-[#1C1C1C]">
            <ShieldCheck size={16} className="text-[#8C857B] mt-0.5 shrink-0" />
            <p className="text-xs text-[#6E675E] leading-relaxed">Este es el registro de la pieza dentro del archivo de Archive Lab. No contiene datos personales ni información de pedidos. Es un registro de la edición, no una prueba infalible de autenticidad.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const Cell = ({ label, value, valueNode, mono }) => (
  <div className="border-b border-[#161616] pb-3">
    <div className="dossier-label text-[#6E675E] mb-1">{label}</div>
    <div className={`text-[#D8D3CB] ${mono ? "font-mono2 text-sm" : "text-sm"}`}>{valueNode || value}</div>
  </div>
);
const Block = ({ label, value }) => (
  <div className="mt-6">
    <div className="dossier-label text-[#6E675E] mb-1">{label}</div>
    <p className="text-sm text-[#A39B8E] leading-relaxed whitespace-pre-line">{value}</p>
  </div>
);
