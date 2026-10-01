import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { LogOut, Package, Plus } from "lucide-react";
import api, { formatARS, errMsg, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";

export default function MiArchivo() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [claimId, setClaimId] = useState("");

  const load = () => {
    api.get("/my/orders").then((r) => setOrders(r.data)).catch(() => {});
    api.get("/my/events").then((r) => setMyEvents(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const claim = async () => {
    if (!claimId.trim()) return;
    try {
      await api.post(`/orders/${claimId.trim()}/claim`);
      toast.success("Pedido sumado a tu archivo");
      setClaimId("");
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const paidOrders = orders.filter((o) => o.status === "paid" && (o.kind || "pieces") !== "event");
  const pieces = paidOrders.flatMap((o) => (o.items || []).filter((i) => i.unit_code).map((i) => ({ ...i, order: o })));

  return (
    <div className="px-4 sm:px-8 lg:px-16 py-12 lg:py-16 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-10">
        <div>
          <div className="dossier-label text-[#6E675E] mb-2">Miembro del archivo</div>
          <h1 className="font-display font-extrabold uppercase tracking-tight text-4xl text-[#F5F4F0]">Mi Archivo</h1>
          <p className="text-[#8C857B] mt-2">{user?.name} · {user?.email}</p>
        </div>
        <button data-testid="logout-button" onClick={logout} className="dossier-label text-[#8C857B] hover:text-[#9E2A2B] inline-flex items-center gap-2">
          <LogOut size={14} /> Salir
        </button>
      </div>

      {/* Pieces */}
      <section className="mb-14">
        <h2 className="font-display font-bold uppercase tracking-tight text-2xl text-[#F5F4F0] mb-5">Mis piezas</h2>
        {pieces.length === 0 ? (
          <div className="museum-frame p-10 text-center">
            <Package className="mx-auto text-[#8C857B] mb-3" size={24} />
            <p className="text-[#8C857B]">Todavía no tenés piezas en tu archivo.</p>
            <Link to="/archivo" className="btn-ink px-6 py-3 dossier-label inline-flex mt-5">Explorar el archivo</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pieces.map((pc) => (
              <div key={pc.unit_id} data-testid={`my-piece-${pc.unit_code}`} className="museum-frame overflow-hidden hover-lift">
                <div className="aspect-[4/3] bg-[#161616] overflow-hidden">
                  {pc.image && <img src={pc.image} alt={pc.name} className="w-full h-full object-cover" />}
                </div>
                <div className="p-4">
                  <div className="dossier-label text-[#6E675E]">{pc.design_code} · talle {pc.size}</div>
                  <h3 className="font-display font-bold uppercase tracking-tight text-[#F5F4F0]">{pc.name}</h3>
                  <div className="dossier-label text-[#72B078] mt-2">{pc.unit_code}</div>
                  <div className="dossier-label text-[#8C857B] mt-1">ejemplar Nº {pc.edition_number}</div>
                  <div className="flex gap-3 mt-4">
                    <Link to={`/pieza/${pc.unit_code}`} className="dossier-label text-[#8C857B] hover:text-[#F5F4F0]">ficha pública</Link>
                    <Link to={`/certificado/${pc.unit_code}`} data-testid={`cert-${pc.unit_code}`} className="dossier-label text-[#E6E2DD] hover:text-white">certificado</Link>
                    <a href={`${API}/certificate/${pc.unit_code}/pdf`} target="_blank" rel="noreferrer" data-testid={`pdf-${pc.unit_code}`} className="dossier-label text-[#8C857B] hover:text-[#F5F4F0]">pdf</a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Orders */}
      <section className="mb-14">
        <h2 className="font-display font-bold uppercase tracking-tight text-2xl text-[#F5F4F0] mb-5">Mis pedidos</h2>
        {orders.length === 0 ? (
          <p className="text-[#8C857B]">Sin pedidos todavía.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((o) => (
              <div key={o.id} className="museum-frame p-5 flex items-center justify-between">
                <div>
                  <div className="dossier-label text-[#6E675E]">{o.id}</div>
                  <div className="text-[#A39B8E] text-sm mt-1">{o.items.length} pieza(s) · {formatARS(o.total)}</div>
                  {o.shipping_status && (
                    <div className="dossier-label mt-2 text-[#8C857B]" data-testid={`order-shipping-${o.id}`}>
                      Envío: {o.shipping_status === "enviado" ? "en camino" : o.shipping_status === "entregado" ? "entregado" : "preparando"}
                      {o.tracking_number && <> · {o.carrier} {o.tracking_number}</>}
                      {o.tracking_url && <> · <a href={o.tracking_url} target="_blank" rel="noreferrer" className="text-[#E6E2DD] hover:underline">seguir</a></>}
                    </div>
                  )}
                </div>
                <span className={`dossier-label px-3 py-1 ${o.status === "paid" ? "bg-[#1C241D] text-[#72B078]" : o.status === "created" ? "bg-[#2A2A2A] text-[#A39B8E]" : "bg-[#2A1515] text-[#c74446]"}`}>
                  {o.status === "paid" ? "pagado" : o.status === "created" ? "pendiente" : o.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* My events */}
      <section className="mb-14">
        <h2 className="font-display font-bold uppercase tracking-tight text-2xl text-[#F5F4F0] mb-5">Mis eventos</h2>
        {myEvents.length === 0 ? (
          <p className="text-[#8C857B]">No estás anotada en ningún evento. <Link to="/eventos" className="text-[#E6E2DD] hover:underline">Ver agenda</Link>.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {myEvents.map((r) => (
              <div key={r.id} data-testid={`my-event-${r.id}`} className="museum-frame p-5 flex items-center justify-between">
                <div>
                  <div className="font-display font-bold uppercase tracking-tight text-[#F5F4F0]">{r.event_title}</div>
                  <div className="dossier-label text-[#6E675E] mt-1">{r.event_date || "fecha a confirmar"}</div>
                </div>
                <span className={`dossier-label px-3 py-1 ${r.status === "pagada" ? "bg-[#1C241D] text-[#72B078]" : r.status === "anotada" ? "bg-[#2A2A2A] text-[#A39B8E]" : "bg-[#2A2415] text-[#b9942f]"}`}>
                  {r.status === "pagada" ? "entrada pagada" : r.status === "anotada" ? "anotada" : "pago pendiente"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Claim */}
      <section className="museum-frame p-6">
        <div className="dossier-label text-[#6E675E] mb-2">Sumar un pedido de invitada</div>
        <p className="text-sm text-[#8C857B] mb-4">¿Compraste sin iniciar sesión? Pegá el número de pedido para sumarlo a tu archivo (se verifica que el email coincida).</p>
        <div className="flex gap-3">
          <Input data-testid="claim-order-input" value={claimId} onChange={(e) => setClaimId(e.target.value)} placeholder="order_xxxxxxxx" className="bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]" />
          <button data-testid="claim-order-button" onClick={claim} className="btn-outline-ink px-5 dossier-label inline-flex items-center gap-2"><Plus size={14} /> Sumar</button>
        </div>
      </section>
    </div>
  );
}
