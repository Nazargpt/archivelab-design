import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import api, { formatARS, errMsg, CATEGORIES } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ProductEditor from "@/pages/admin/ProductEditor";

const TABS = [["piezas", "Piezas"], ["pedidos", "Pedidos"], ["contenido", "Contenido"], ["ajustes", "Ajustes"]];
const field = "mt-1.5 bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]";
const lbl = "dossier-label text-[#6E675E]";

export default function Admin() {
  const [tab, setTab] = useState("piezas");

  return (
    <div className="px-4 sm:px-8 lg:px-16 py-10">
      <div className="dossier-label text-[#9E2A2B] mb-2">Laboratorio · administración</div>
      <h1 className="font-display font-extrabold uppercase tracking-tight text-4xl text-[#F5F4F0] mb-8">Panel</h1>

      <div className="flex gap-2 border-b border-[#1C1C1C] mb-8 overflow-x-auto no-scrollbar">
        {TABS.map(([k, l]) => (
          <button key={k} data-testid={`admin-tab-${k}`} onClick={() => setTab(k)} className={`dossier-label px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${tab === k ? "border-[#E6E2DD] text-[#F5F4F0]" : "border-transparent text-[#6E675E] hover:text-[#A39B8E]"}`}>{l}</button>
        ))}
      </div>

      {tab === "piezas" && <PiezasTab />}
      {tab === "pedidos" && <PedidosTab />}
      {tab === "contenido" && <ContenidoTab />}
      {tab === "ajustes" && <AjustesTab />}
    </div>
  );
}

function PiezasTab() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/admin/products").then((r) => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const del = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("¿Eliminar esta pieza?")) return;
    try { await api.delete(`/admin/products/${id}`); toast.success("Pieza eliminada"); load(); }
    catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div>
      <button data-testid="new-product-button" onClick={() => setEditing({})} className="btn-ink px-6 py-3 dossier-label inline-flex items-center gap-2 mb-6"><Plus size={16} /> Nueva pieza</button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((p) => (
          <div key={p.id} data-testid={`admin-product-${p.id}`} onClick={() => setEditing(p)} className="museum-frame p-4 flex gap-4 cursor-pointer hover-lift">
            <div className="w-16 h-20 bg-[#161616] overflow-hidden shrink-0">{p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}</div>
            <div className="flex-1 min-w-0">
              <div className="dossier-label text-[#6E675E]">{p.design_code} · {CATEGORIES.find((c) => c.key === p.category)?.label}</div>
              <h3 className="font-display font-bold uppercase tracking-tight text-[#F5F4F0] truncate">{p.name}</h3>
              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className={`dossier-label ${p.status === "published" ? "text-[#72B078]" : p.status === "draft" ? "text-[#A39B8E]" : "text-[#6E675E]"}`}>{p.status}</span>
                <span className="text-[#8C857B]">{p.price != null ? formatARS(p.price) : "sin precio"}</span>
                <span className="text-[#6E675E]">{p.available_total}/{p.units_total} u.</span>
                {p.vip && <span className="dossier-label text-[#9E2A2B]">VIP</span>}
              </div>
            </div>
            <button data-testid={`delete-product-${p.id}`} onClick={(e) => del(p.id, e)} className="dossier-label text-[#6E675E] hover:text-[#9E2A2B] self-start">eliminar</button>
          </div>
        ))}
      </div>
      {editing && <ProductEditor product={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function PedidosTab() {
  const [orders, setOrders] = useState([]);
  useEffect(() => { api.get("/admin/orders").then((r) => setOrders(r.data)).catch(() => {}); }, []);
  return (
    <div className="flex flex-col gap-3">
      {orders.length === 0 && <p className="text-[#8C857B]">Sin pedidos todavía.</p>}
      {orders.map((o) => (
        <div key={o.id} data-testid={`admin-order-${o.id}`} className="museum-frame p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono2 text-xs text-[#D8D3CB]">{o.id}</div>
              <div className="text-sm text-[#A39B8E] mt-1">{o.guest_name} · {o.guest_email}</div>
            </div>
            <div className="text-right">
              <span className={`dossier-label px-3 py-1 ${o.status === "paid" ? "bg-[#1C241D] text-[#72B078]" : "bg-[#2A2A2A] text-[#A39B8E]"}`}>{o.status}</span>
              <div className="text-[#E6E2DD] mt-2">{formatARS(o.total)}</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#161616] text-xs text-[#8C857B]">
            {o.items.map((i) => <div key={i.unit_id}>{i.name} · T{i.size} · {i.unit_code}</div>)}
            <div className="mt-1 text-[#6E675E]">Entrega: {o.shipping_method} {o.shipping_address && `· ${o.shipping_address}`}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ContenidoTab() {
  const [home, setHome] = useState({ hero_title: "", hero_subtitle: "", hero_video: "", manifesto: "", creator_bio: "" });
  const [legal, setLegal] = useState({ privacy: "", terms: "", returns: "" });

  useEffect(() => {
    api.get("/content/home").then((r) => setHome((h) => ({ ...h, ...r.data }))).catch(() => {});
    api.get("/content/legal").then((r) => setLegal((l) => ({ ...l, ...r.data }))).catch(() => {});
  }, []);

  const saveHome = async () => { try { await api.put("/admin/content/home", home); toast.success("Inicio actualizado"); } catch (e) { toast.error(errMsg(e)); } };
  const saveLegal = async () => { try { await api.put("/admin/content/legal", legal); toast.success("Textos legales actualizados"); } catch (e) { toast.error(errMsg(e)); } };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-5xl">
      <div className="space-y-4">
        <h3 className="font-display font-bold uppercase tracking-tight text-xl text-[#F5F4F0]">Inicio</h3>
        <div><Label className={lbl}>Título del hero</Label><Input className={field} value={home.hero_title} onChange={(e) => setHome({ ...home, hero_title: e.target.value })} /></div>
        <div><Label className={lbl}>Subtítulo</Label><Textarea className={field} value={home.hero_subtitle} onChange={(e) => setHome({ ...home, hero_subtitle: e.target.value })} /></div>
        <div><Label className={lbl}>URL del video del hero (opcional)</Label><Input className={field} value={home.hero_video || ""} onChange={(e) => setHome({ ...home, hero_video: e.target.value })} /></div>
        <div><Label className={lbl}>Manifiesto</Label><Textarea rows={4} className={field} value={home.manifesto} onChange={(e) => setHome({ ...home, manifesto: e.target.value })} /></div>
        <div><Label className={lbl}>Bio de la creadora</Label><Textarea rows={3} className={field} value={home.creator_bio} onChange={(e) => setHome({ ...home, creator_bio: e.target.value })} /></div>
        <button data-testid="save-home" onClick={saveHome} className="btn-ink px-6 py-3 dossier-label">Guardar inicio</button>
      </div>
      <div className="space-y-4">
        <h3 className="font-display font-bold uppercase tracking-tight text-xl text-[#F5F4F0]">Textos legales</h3>
        <div><Label className={lbl}>Privacidad</Label><Textarea rows={4} className={field} value={legal.privacy} onChange={(e) => setLegal({ ...legal, privacy: e.target.value })} /></div>
        <div><Label className={lbl}>Condiciones de compra</Label><Textarea rows={4} className={field} value={legal.terms} onChange={(e) => setLegal({ ...legal, terms: e.target.value })} /></div>
        <div><Label className={lbl}>Cambios y devoluciones</Label><Textarea rows={4} className={field} value={legal.returns} onChange={(e) => setLegal({ ...legal, returns: e.target.value })} /></div>
        <button data-testid="save-legal" onClick={saveLegal} className="btn-ink px-6 py-3 dossier-label">Guardar legales</button>
      </div>
    </div>
  );
}

function AjustesTab() {
  const [s, setS] = useState({ currency: "ARS", pickup_enabled: true, contact_email: "", contact_whatsapp: "", instagram: "", pinterest: "", address: "", shipping_zones: [] });
  useEffect(() => { api.get("/settings").then((r) => setS((p) => ({ ...p, ...r.data }))).catch(() => {}); }, []);
  const save = async () => { try { await api.put("/admin/settings", s); toast.success("Ajustes guardados"); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="max-w-lg space-y-4">
      <div><Label className={lbl}>Email de contacto</Label><Input data-testid="set-email" className={field} value={s.contact_email} onChange={(e) => setS({ ...s, contact_email: e.target.value })} /></div>
      <div><Label className={lbl}>WhatsApp</Label><Input className={field} value={s.contact_whatsapp} onChange={(e) => setS({ ...s, contact_whatsapp: e.target.value })} /></div>
      <div><Label className={lbl}>Instagram (sin @)</Label><Input className={field} value={s.instagram} onChange={(e) => setS({ ...s, instagram: e.target.value })} /></div>
      <div><Label className={lbl}>Pinterest</Label><Input className={field} value={s.pinterest} onChange={(e) => setS({ ...s, pinterest: e.target.value })} /></div>
      <div><Label className={lbl}>Dirección</Label><Input className={field} value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} /></div>
      <button data-testid="save-settings" onClick={save} className="btn-ink px-6 py-3 dossier-label">Guardar ajustes</button>
    </div>
  );
}
