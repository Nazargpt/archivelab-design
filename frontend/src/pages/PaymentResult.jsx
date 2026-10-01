import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Clock } from "lucide-react";
import api, { formatARS } from "@/lib/api";
import { useCart } from "@/context/CartContext";

export default function PaymentResult() {
  const [sp] = useSearchParams();
  const orderId = sp.get("order_id");
  const [order, setOrder] = useState(null);
  const { clear } = useCart();
  const cleared = useRef(false);

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    const poll = async () => {
      try {
        const { data } = await api.get(`/orders/${orderId}`);
        if (!active) return;
        setOrder(data);
        if (data.status === "paid") {
          if (!cleared.current) { clear(); cleared.current = true; }
          return;
        }
      } catch {}
      if (active) setTimeout(poll, 2500);
    };
    poll();
    return () => { active = false; };
  }, [orderId]);

  const paid = order?.status === "paid";

  return (
    <div className="px-4 py-20 max-w-2xl mx-auto">
      <div className="museum-frame p-10 text-center">
        {paid ? (
          <>
            <CheckCircle2 className="mx-auto text-[#72B078] mb-5" size={40} />
            <h1 className="font-display font-extrabold uppercase tracking-tight text-3xl text-[#F5F4F0]">Pieza en tu archivo</h1>
            <p className="text-[#A39B8E] mt-3">Tu pago fue confirmado. Estas piezas ahora forman parte de tu archivo personal.</p>
            <div className="mt-8 text-left border-t border-[#2A2A2A] pt-6">
              <div className="dossier-label text-[#6E675E] mb-4">Códigos únicos de tus piezas</div>
              {order.items?.map((i) => (
                <div key={i.unit_id} className="flex items-center justify-between py-3 border-b border-[#161616]">
                  <div>
                    <div className="text-[#F5F4F0] font-display font-bold uppercase tracking-tight">{i.name}</div>
                    <div className="dossier-label text-[#8C857B] mt-1">{i.unit_code} · talle {i.size} · ej. {i.edition_number}</div>
                  </div>
                  <Link to={`/pieza/${i.unit_code}`} className="dossier-label text-[#8C857B] hover:text-[#F5F4F0]">ver ficha</Link>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-center mt-8">
              <Link to="/mi-archivo" data-testid="goto-archive" className="btn-ink px-7 py-3 dossier-label">Ir a Mi Archivo</Link>
              <Link to="/archivo" className="btn-outline-ink px-7 py-3 dossier-label">Seguir explorando</Link>
            </div>
          </>
        ) : (
          <>
            <Clock className="mx-auto text-[#8C857B] mb-5 animate-pulse" size={40} />
            <h1 className="font-display font-bold uppercase tracking-tight text-2xl text-[#F5F4F0]">Verificando el pago…</h1>
            <p className="text-[#8C857B] mt-3 text-sm">Estamos confirmando tu pedido desde el servidor. No cierres esta ventana.</p>
          </>
        )}
      </div>
    </div>
  );
}
