import React, { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import api, { formatARS, errMsg } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";

const PROVINCES = ["CABA", "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"];

export default function Checkout() {
  const { items, total } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(user?.email || "");
  const [name, setName] = useState(user?.name || "");
  const [shipping, setShipping] = useState("envio");
  const [address, setAddress] = useState("");
  const [province, setProvince] = useState("");
  const [shipCost, setShipCost] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (shipping === "retiro") { setShipCost(0); return; }
    api.post("/shipping/quote", { province, subtotal: total }).then((r) => {
      const envio = (r.data.options || []).find((o) => o.method === "envio");
      setShipCost(envio ? envio.cost : 0);
    }).catch(() => setShipCost(0));
  }, [shipping, province, total]);

  const grand = total + (shipping === "retiro" ? 0 : shipCost);

  if (items.length === 0) return <Navigate to="/carrito" replace />;

  const pay = async () => {
    if (!email || !name) return toast.error("Completá tu nombre y email");
    if (shipping === "envio" && !address.trim()) return toast.error("Ingresá una dirección de envío");
    if (shipping === "envio" && !province) return toast.error("Elegí tu provincia");
    setBusy(true);
    try {
      const { data } = await api.post("/checkout", {
        items: items.map((i) => ({ product_id: i.product_id, size: i.size })),
        guest_email: email, guest_name: name,
        shipping_method: shipping, shipping_address: address,
        shipping_province: province, shipping_cost: shipping === "retiro" ? 0 : shipCost,
      });
      if (data.demo) {
        navigate(`/checkout/demo/${data.order_id}`);
      } else if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (e) {
      toast.error(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <div className="px-4 sm:px-8 lg:px-16 py-12 lg:py-16 max-w-5xl mx-auto">
      <div className="dossier-label text-[#6E675E] mb-3">Finalizar adquisición</div>
      <h1 className="font-display font-extrabold uppercase tracking-tight text-4xl text-[#F5F4F0] mb-10">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-3 flex flex-col gap-6">
          {!user && (
            <p className="text-xs text-[#8C857B] museum-frame p-3">Estás comprando como invitada. Después vas a poder sumar este pedido a tu cuenta desde "Mi Archivo".</p>
          )}
          <div>
            <Label className="dossier-label text-[#6E675E]">Nombre y apellido</Label>
            <Input data-testid="checkout-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-2 bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]" placeholder="Tu nombre" />
          </div>
          <div>
            <Label className="dossier-label text-[#6E675E]">Email</Label>
            <Input data-testid="checkout-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]" placeholder="tu@email.com" />
          </div>
          <div>
            <Label className="dossier-label text-[#6E675E] mb-2 block">Entrega</Label>
            <div className="flex flex-col gap-2">
              {[{ k: "envio", l: "Envío a domicilio (a coordinar por zona)" }, { k: "retiro", l: "Retiro en persona (CABA)" }].map((o) => (
                <button key={o.k} data-testid={`shipping-${o.k}`} onClick={() => setShipping(o.k)} className={`text-left px-4 py-3 border transition-colors ${shipping === o.k ? "border-[#E6E2DD] text-[#F5F4F0]" : "border-[#2A2A2A] text-[#A39B8E] hover:border-[#555]"}`}>
                  <span className="text-sm">{o.l}</span>
                </button>
              ))}
            </div>
          </div>
          {shipping === "envio" && (
            <>
              <div>
                <Label className="dossier-label text-[#6E675E]">Provincia</Label>
                <select data-testid="checkout-province" value={province} onChange={(e) => setProvince(e.target.value)} className="mt-2 w-full h-10 px-3 rounded-md border bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]">
                  <option value="">Elegí tu provincia</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label className="dossier-label text-[#6E675E]">Dirección</Label>
                <Textarea data-testid="checkout-address" value={address} onChange={(e) => setAddress(e.target.value)} className="mt-2 bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]" placeholder="Calle, número, localidad, CP" />
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-2 museum-frame p-6 h-fit">
          <div className="dossier-label text-[#6E675E] mb-4">Tu pedido</div>
          <div className="flex flex-col gap-3 mb-4">
            {items.map((i) => (
              <div key={i.key} className="flex justify-between text-sm">
                <span className="text-[#A39B8E]">{i.name} · {i.size}</span>
                <span className="text-[#E6E2DD]">{formatARS(i.price)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[#A39B8E] text-sm border-t border-[#2A2A2A] pt-3">
            <span>Subtotal</span><span>{formatARS(total)}</span>
          </div>
          <div className="flex justify-between text-[#A39B8E] text-sm mt-1">
            <span>Envío{shipping === "retiro" ? " (retiro)" : province ? ` · ${province}` : ""}</span>
            <span data-testid="checkout-shipping">{(shipping === "retiro" || shipCost === 0) ? "Gratis" : formatARS(shipCost)}</span>
          </div>
          <div className="flex justify-between text-[#F5F4F0] text-lg font-medium border-t border-[#2A2A2A] pt-3 mt-2">
            <span>Total</span><span data-testid="checkout-total">{formatARS(grand)}</span>
          </div>
          <button data-testid="pay-button" onClick={pay} disabled={busy} className="btn-ink w-full py-4 mt-6 dossier-label disabled:opacity-60">
            {busy ? "Procesando…" : "Pagar con Mercado Pago"}
          </button>
          <p className="text-[10px] text-[#6E675E] mt-3 text-center dossier-label">Pago seguro · confirmado desde el servidor</p>
        </div>
      </div>
    </div>
  );
}
