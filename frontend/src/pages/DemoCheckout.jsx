import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
import api, { formatARS, errMsg } from "@/lib/api";
import { useCart } from "@/context/CartContext";

export default function DemoCheckout() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { clear } = useCart();
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/orders/${orderId}`).then((r) => setOrder(r.data)).catch(() => {});
  }, [orderId]);

  const approve = async () => {
    setBusy(true);
    try {
      await api.post(`/demo/approve/${orderId}`);
      clear();
      navigate(`/payment-result?order_id=${orderId}`);
    } catch (e) {
      toast.error(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-16 max-w-xl mx-auto">
      <div className="museum-frame p-8">
        <div className="flex items-center gap-2 mb-5 border border-[#9E2A2B]/40 bg-[#9E2A2B]/10 px-3 py-2 w-fit">
          <FlaskConical size={14} className="text-[#c74446]" />
          <span className="dossier-label text-[#c74446]">Modo prueba · Mercado Pago sin credenciales</span>
        </div>
        <h1 className="font-display font-bold uppercase tracking-tight text-2xl text-[#F5F4F0]">Simulación de pago</h1>
        <p className="text-sm text-[#8C857B] mt-2 leading-relaxed">No se cobra dinero real. Esta pantalla reemplaza a Mercado Pago hasta cargar las credenciales de producción. El pedido se confirma desde el servidor.</p>

        {order && (
          <div className="mt-6 border-t border-[#2A2A2A] pt-4">
            <div className="dossier-label text-[#6E675E] mb-3">Pedido {order.id}</div>
            {order.items?.map((i, idx) => (
              <div key={i.unit_id || idx} className="flex justify-between text-sm mb-2">
                <span className="text-[#A39B8E]">{i.name}{i.size ? ` · ${i.size}` : ""}{i.edition_number ? ` · Nº ${i.edition_number}` : ""}</span>
                <span className="text-[#E6E2DD]">{formatARS(i.price)}</span>
              </div>
            ))}
            <div className="flex justify-between text-[#F5F4F0] font-medium border-t border-[#2A2A2A] pt-3 mt-3">
              <span>Total</span><span>{formatARS(order.total)}</span>
            </div>
          </div>
        )}

        <button data-testid="demo-approve-button" onClick={approve} disabled={busy} className="btn-ink w-full py-4 mt-6 dossier-label disabled:opacity-60">
          {busy ? "Confirmando…" : "Simular pago aprobado"}
        </button>
        <button onClick={() => navigate("/carrito")} className="w-full py-3 mt-2 dossier-label text-[#8C857B] hover:text-[#F5F4F0]">Cancelar</button>
      </div>
    </div>
  );
}
