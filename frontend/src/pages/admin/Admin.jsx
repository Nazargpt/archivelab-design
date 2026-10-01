import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Trash2, Users } from "lucide-react";
import api, { formatARS, errMsg, CATEGORIES } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ProductEditor from "@/pages/admin/ProductEditor";

const TABS = [["piezas", "Piezas"], ["eventos", "Eventos"], ["pedidos", "Pedidos"], ["contenido", "Contenido"], ["ajustes", "Ajustes"]];
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
      {tab === "eventos" && <EventosTab />}
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

function EventosTab() {
  const [events, setEvents] = useState([]);
  const [editing, setEditing] = useState(null);
  const [regsFor, setRegsFor] = useState(null);

  const load = () => api.get("/admin/events").then((r) => setEvents(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const del = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("¿Eliminar este evento?")) return;
    try { await api.delete(`/admin/events/${id}`); toast.success("Evento eliminado"); load(); }
    catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div>
      <button data-testid="new-event-button" onClick={() => setEditing({})} className="btn-ink px-6 py-3 dossier-label inline-flex items-center gap-2 mb-6"><Plus size={16} /> Nuevo evento</button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {events.map((ev) => (
          <div key={ev.id} data-testid={`admin-event-${ev.id}`} onClick={() => setEditing(ev)} className="museum-frame p-4 flex gap-4 cursor-pointer hover-lift">
            <div className="w-16 h-16 bg-[#161616] overflow-hidden shrink-0">{ev.image && <img src={ev.image} alt="" className="w-full h-full object-cover" />}</div>
            <div className="flex-1 min-w-0">
              <div className="dossier-label text-[#6E675E]">{ev.type} · {ev.date || "s/fecha"}</div>
              <h3 className="font-display font-bold uppercase tracking-tight text-[#F5F4F0] truncate">{ev.title}</h3>
              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className={`dossier-label ${ev.status === "published" ? "text-[#72B078]" : "text-[#A39B8E]"}`}>{ev.status}</span>
                <span className="text-[#8C857B]">{ev.price != null ? formatARS(ev.price) : "libre"}</span>
                <span className="text-[#6E675E]">{ev.registered_count} anotad{ev.capacity ? `/${ev.capacity}` : "@s"}</span>
              </div>
              <div className="flex gap-3 mt-2">
                <button data-testid={`event-regs-${ev.id}`} onClick={(e) => { e.stopPropagation(); setRegsFor(ev); }} className="dossier-label text-[#8C857B] hover:text-[#F5F4F0] inline-flex items-center gap-1"><Users size={12} /> inscriptas</button>
                <button onClick={(e) => del(ev.id, e)} className="dossier-label text-[#6E675E] hover:text-[#9E2A2B]">eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && <EventEditor event={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {regsFor && <RegsModal event={regsFor} onClose={() => setRegsFor(null)} />}
    </div>
  );
}

function EventEditor({ event, onClose, onSaved }) {
  const [f, setF] = useState({ title: "", type: "desfile", description: "", date: "", location: "", image: "", price: "", capacity: "", status: "draft" });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (event) setF({ ...f, ...event, price: event.price ?? "", capacity: event.capacity ?? "", image: event.image || "" }); }, [event]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.title) return toast.error("El título es obligatorio");
    setSaving(true);
    const payload = { ...f, price: f.price === "" ? null : Number(f.price), capacity: f.capacity === "" ? null : Number(f.capacity), image: f.image || null };
    try {
      if (event?.id) await api.put(`/admin/events/${event.id}`, payload);
      else await api.post("/admin/events", payload);
      toast.success("Evento guardado"); onSaved();
    } catch (e) { toast.error(errMsg(e)); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm overflow-y-auto" data-testid="event-editor">
      <div className="min-h-screen flex items-start justify-center p-4 py-10">
        <div className="bg-[#0E0E0E] border border-[#2A2A2A] w-full max-w-xl">
          <div className="flex items-center justify-between p-5 border-b border-[#1C1C1C]">
            <h2 className="font-display font-bold uppercase tracking-tight text-xl text-[#F5F4F0]">{event?.id ? "Editar evento" : "Nuevo evento"}</h2>
            <button onClick={onClose} className="text-[#8C857B] hover:text-[#F5F4F0]"><X size={20} /></button>
          </div>
          <div className="p-5 space-y-4">
            <div><Label className={lbl}>Título</Label><Input data-testid="ev-title" className={field} value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={lbl}>Tipo</Label>
                <select data-testid="ev-type" value={f.type} onChange={(e) => set("type", e.target.value)} className={`${field} w-full h-10 px-3 rounded-md border`}>
                  <option value="desfile">Desfile</option><option value="lanzamiento">Lanzamiento</option>
                  <option value="exposicion">Exposición</option><option value="presentacion">Presentación</option>
                </select>
              </div>
              <div>
                <Label className={lbl}>Estado</Label>
                <select data-testid="ev-status" value={f.status} onChange={(e) => set("status", e.target.value)} className={`${field} w-full h-10 px-3 rounded-md border`}>
                  <option value="draft">Borrador</option><option value="published">Publicado</option>
                </select>
              </div>
              <div><Label className={lbl}>Fecha (texto)</Label><Input className={field} value={f.date} onChange={(e) => set("date", e.target.value)} placeholder="A confirmar" /></div>
              <div><Label className={lbl}>Lugar</Label><Input className={field} value={f.location} onChange={(e) => set("location", e.target.value)} /></div>
              <div><Label className={lbl}>Precio ARS (vacío = libre)</Label><Input data-testid="ev-price" type="number" className={field} value={f.price} onChange={(e) => set("price", e.target.value)} /></div>
              <div><Label className={lbl}>Cupos (vacío = sin tope)</Label><Input type="number" className={field} value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></div>
            </div>
            <div><Label className={lbl}>URL de imagen</Label><Input className={field} value={f.image} onChange={(e) => set("image", e.target.value)} placeholder="https://…" /></div>
            <div><Label className={lbl}>Descripción</Label><Textarea rows={3} className={field} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
          </div>
          <div className="flex gap-3 p-5 border-t border-[#1C1C1C]">
            <button data-testid="ev-save" onClick={save} disabled={saving} className="btn-ink px-7 py-3 dossier-label disabled:opacity-60">{saving ? "Guardando…" : "Guardar evento"}</button>
            <button onClick={onClose} className="btn-outline-ink px-7 py-3 dossier-label">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegsModal({ event, onClose }) {
  const [regs, setRegs] = useState([]);
  useEffect(() => { api.get(`/admin/events/${event.id}/registrations`).then((r) => setRegs(r.data)).catch(() => {}); }, [event]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0E0E0E] border border-[#2A2A2A] w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[#1C1C1C]">
          <h2 className="font-display font-bold uppercase tracking-tight text-lg text-[#F5F4F0]">Inscriptas · {event.title}</h2>
          <button onClick={onClose} className="text-[#8C857B] hover:text-[#F5F4F0]"><X size={18} /></button>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto no-scrollbar">
          {regs.length === 0 ? <p className="text-[#8C857B] text-sm">Sin inscripciones todavía.</p> : regs.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-[#161616] text-sm">
              <div><div className="text-[#F5F4F0]">{r.name}</div><div className="text-[#6E675E] text-xs">{r.email}</div></div>
              <span className={`dossier-label px-2 py-1 ${r.status === "pagada" ? "bg-[#1C241D] text-[#72B078]" : r.status === "anotada" ? "bg-[#2A2A2A] text-[#A39B8E]" : "bg-[#2A2415] text-[#b9942f]"}`}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>
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
