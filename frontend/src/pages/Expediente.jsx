import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ShoppingBag, ArrowLeft, Check } from "lucide-react";
import api, { formatARS } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { WaitlistModal } from "@/components/WaitlistModal";

export default function Expediente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [p, setP] = useState(null);
  const [active, setActive] = useState(0);
  const [size, setSize] = useState("");
  const [notfound, setNotfound] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);

  useEffect(() => {
    api.get(`/products/${id}`).then((r) => {
      setP(r.data);
      const avail = r.data.available_by_size || {};
      const firstAvail = (r.data.sizes || []).find((s) => (avail[s.label] || 0) > 0);
      if (firstAvail) setSize(firstAvail.label);
    }).catch(() => setNotfound(true));
  }, [id]);

  if (notfound) return <div className="py-32 text-center dossier-label text-[#8C857B]">Pieza no encontrada</div>;
  if (!p) return <div className="py-32 text-center dossier-label text-[#6E675E] animate-pulse">abriendo expediente…</div>;

  const avail = p.available_by_size || {};
  const canBuy = p.price != null && (avail[size] || 0) > 0;

  const add = () => {
    if (!size) return toast.error("Elegí un talle");
    if (!canBuy) return toast.error("Sin unidades disponibles en ese talle");
    addItem({ key: `${p.id}-${size}`, product_id: p.id, name: p.name, size, price: p.price, image: p.images?.[0], design_code: p.design_code });
    toast.success("Guardado en tu carrito", { description: `${p.name} · talle ${size}` });
  };

  const Field = ({ label, value }) => value ? (
    <div className="py-4 border-b border-[#161616]">
      <div className="dossier-label text-[#6E675E] mb-1">{label}</div>
      <div className="text-[#D8D3CB] text-sm leading-relaxed whitespace-pre-line">{value}</div>
    </div>
  ) : null;

  return (
    <div className="px-4 sm:px-8 lg:px-16 py-8 lg:py-12">
      <button onClick={() => navigate(-1)} data-testid="back-button" className="dossier-label text-[#8C857B] hover:text-[#F5F4F0] inline-flex items-center gap-2 mb-8">
        <ArrowLeft size={14} /> Volver al archivo
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
        {/* Gallery */}
        <div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="museum-frame aspect-[3/4] bg-[#161616] overflow-hidden">
            {p.images?.[active] ? (
              <img src={p.images[active]} alt={p.name} className="w-full h-full object-cover" />
            ) : <div className="w-full h-full flex items-center justify-center dossier-label text-[#4A453F]">sin imagen</div>}
          </motion.div>
          {p.images?.length > 1 && (
            <div className="flex gap-3 mt-3">
              {p.images.map((img, i) => (
                <button key={i} onClick={() => setActive(i)} data-testid={`gallery-thumb-${i}`} className={`w-20 h-24 overflow-hidden border ${active === i ? "border-[#E6E2DD]" : "border-[#2A2A2A]"}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {p.video && (
            <video className="w-full mt-3 museum-frame" src={p.video} controls muted playsInline poster={p.images?.[0]} />
          )}
        </div>

        {/* Dossier */}
        <div>
          <div className="dossier-label text-[#6E675E] mb-2">
            {p.design_code} · {p.edition_name || "Expediente"}{p.vip && <span className="text-[#9E2A2B] ml-2">· VIP</span>}
          </div>
          <h1 className="font-display font-extrabold uppercase tracking-tight text-3xl lg:text-5xl text-[#F5F4F0] leading-none">{p.name}</h1>

          <div className="flex items-center gap-4 mt-5">
            {p.price != null ? (
              <span data-testid="product-price" className="text-2xl text-[#E6E2DD] font-medium">{formatARS(p.price)}</span>
            ) : (
              <span className="text-lg text-[#8C857B] italic">Pieza en desarrollo · consultá por disponibilidad</span>
            )}
            {p.edition_total && <span className="dossier-label text-[#72B078]">edición de {p.edition_total}</span>}
          </div>

          {p.concept && <p className="mt-6 text-[#A39B8E] leading-relaxed">{p.concept}</p>}

          {/* Sizes */}
          {p.price != null && (
            <div className="mt-8">
              <div className="dossier-label text-[#6E675E] mb-3">Elegí tu talle</div>
              <div className="flex flex-wrap gap-2">
                {(p.sizes || []).map((s) => {
                  const n = avail[s.label] || 0;
                  const dis = n <= 0;
                  return (
                    <button key={s.label} data-testid={`size-${s.label}`} disabled={dis} onClick={() => setSize(s.label)}
                      className={`px-4 py-3 border text-left transition-colors ${dis ? "border-[#1C1C1C] text-[#3A3A3A] cursor-not-allowed line-through" : size === s.label ? "border-[#E6E2DD] bg-[#E6E2DD]/5 text-[#F5F4F0]" : "border-[#2A2A2A] text-[#A39B8E] hover:border-[#555]"}`}>
                      <div className="font-display font-bold">{s.label}</div>
                      <div className="dossier-label text-[10px] mt-1">{dis ? "agotado" : `${n} disp.`}</div>
                    </button>
                  );
                })}
              </div>
              {size && p.sizes?.find((s) => s.label === size)?.measurements && (
                <p className="text-xs text-[#6E675E] mt-3">Medidas reales: {p.sizes.find((s) => s.label === size).measurements}</p>
              )}

              <button data-testid="add-to-cart-button" onClick={add} disabled={!canBuy}
                className={`mt-6 w-full py-4 inline-flex items-center justify-center gap-3 dossier-label ${canBuy ? "btn-ink" : "bg-[#1C1C1C] text-[#555] cursor-not-allowed"}`}>
                <ShoppingBag size={16} /> {canBuy ? "Agregar al carrito" : "Sin disponibilidad"}
              </button>
              {p.available_total <= 0 && (
                <button data-testid="waitlist-button" onClick={() => setShowWaitlist(true)} className="mt-3 w-full py-3 btn-outline-ink dossier-label">
                  Avisame si vuelve
                </button>
              )}
            </div>
          )}

          {p.price == null && (
            <Link to="/contacto" data-testid="consulta-cta" className="mt-6 inline-flex btn-outline-ink px-6 py-3 dossier-label">Consultar / anotar interés</Link>
          )}

          <div className="mt-10">
            <Field label="Intervenciones" value={p.interventions} />
            <Field label="Materiales y avíos" value={p.materials} />
            <Field label="Color" value={p.color} />
            <Field label="Cuidados" value={p.care} />
            <Field label="Envío" value={p.shipping_info} />
          </div>

          <div className="mt-6 flex items-start gap-3 p-4 museum-frame">
            <Check size={16} className="text-[#72B078] mt-0.5" />
            <p className="text-xs text-[#8C857B] leading-relaxed">Cada unidad lleva un código único permanente. Al comprarla, la pieza entra a tu archivo personal con su ficha digital y su número de ejemplar.</p>
          </div>
        </div>
      </div>

      {showWaitlist && <WaitlistModal kind="product" refId={p.id} title={p.name} onClose={() => setShowWaitlist(false)} />}
    </div>
  );
}
