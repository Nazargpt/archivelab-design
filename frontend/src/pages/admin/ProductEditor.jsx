import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Upload, Trash2, Plus, QrCode, Download, Loader2 } from "lucide-react";
import api, { API, CATEGORIES, errMsg, formatARS } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const EMPTY = {
  name: "", design_code: "", edition_name: "", edition_total: "", category: "denim",
  vip: false, concept: "", interventions: "", materials: "", care: "", shipping_info: "",
  color: "", price: "", sizes: [{ label: "1", measurements: "" }], images: [], video: null, status: "draft",
};

const field = "mt-1.5 bg-[#121212] border-[#2A2A2A] text-[#F5F4F0]";
const lbl = "dossier-label text-[#6E675E]";

export default function ProductEditor({ product, onClose, onSaved }) {
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [wlVersion, setWlVersion] = useState(0);
  const fileRef = useRef();
  const videoRef = useRef();
  const token = localStorage.getItem("archive_token");

  useEffect(() => {
    if (product) setF({ ...EMPTY, ...product, edition_total: product.edition_total ?? "", price: product.price ?? "" });
  }, [product]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const upload = async (file, isVideo) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (isVideo) set("video", data.url);
      else set("images", [...f.images, data.url]);
      toast.success("Archivo subido");
    } catch (e) { toast.error(errMsg(e)); }
    setUploading(false);
  };

  const save = async () => {
    if (!f.name || !f.design_code) return toast.error("Nombre y código de diseño son obligatorios");
    setSaving(true);
    const payload = {
      ...f,
      edition_total: f.edition_total === "" ? null : Number(f.edition_total),
      price: f.price === "" ? null : Number(f.price),
      sizes: f.sizes.filter((s) => s.label),
    };
    try {
      let saved;
      if (product?.id) saved = (await api.put(`/admin/products/${product.id}`, payload)).data;
      else saved = (await api.post("/admin/products", payload)).data;
      toast.success("Pieza guardada");
      onSaved(saved);
    } catch (e) { toast.error(errMsg(e)); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm overflow-y-auto" data-testid="product-editor">
      <div className="min-h-screen flex items-start justify-center p-4 py-10">
        <div className="bg-[#0E0E0E] border border-[#2A2A2A] w-full max-w-3xl">
          <div className="flex items-center justify-between p-5 border-b border-[#1C1C1C] sticky top-0 bg-[#0E0E0E] z-10">
            <h2 className="font-display font-bold uppercase tracking-tight text-xl text-[#F5F4F0]">{product?.id ? "Editar pieza" : "Nueva pieza"}</h2>
            <button data-testid="editor-close" onClick={onClose} className="text-[#8C857B] hover:text-[#F5F4F0]"><X size={20} /></button>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label className={lbl}>Nombre de la pieza</Label><Input data-testid="pe-name" className={field} value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
              <div><Label className={lbl}>Código de diseño</Label><Input data-testid="pe-code" className={field} value={f.design_code} onChange={(e) => set("design_code", e.target.value)} placeholder="DNM01" /></div>
              <div><Label className={lbl}>Edición</Label><Input className={field} value={f.edition_name} onChange={(e) => set("edition_name", e.target.value)} placeholder="Liberación I" /></div>
              <div>
                <Label className={lbl}>Categoría</Label>
                <select data-testid="pe-category" value={f.category} onChange={(e) => set("category", e.target.value)} className={`${field} w-full h-10 px-3 rounded-md border`}>
                  {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div><Label className={lbl}>Color</Label><Input className={field} value={f.color} onChange={(e) => set("color", e.target.value)} /></div>
              <div><Label className={lbl}>Precio ARS (vacío = sin precio)</Label><Input data-testid="pe-price" type="number" className={field} value={f.price} onChange={(e) => set("price", e.target.value)} /></div>
              <div><Label className={lbl}>Total de la edición</Label><Input type="number" className={field} value={f.edition_total} onChange={(e) => set("edition_total", e.target.value)} /></div>
              <div className="flex items-center gap-3 pt-6">
                <input data-testid="pe-vip" id="vip" type="checkbox" checked={f.vip} onChange={(e) => set("vip", e.target.checked)} className="w-4 h-4 accent-[#9E2A2B]" />
                <Label htmlFor="vip" className="text-[#A39B8E] text-sm">Sección VIP Camila Guerra</Label>
              </div>
              <div>
                <Label className={lbl}>Estado</Label>
                <select data-testid="pe-status" value={f.status} onChange={(e) => set("status", e.target.value)} className={`${field} w-full h-10 px-3 rounded-md border`}>
                  <option value="draft">Borrador</option>
                  <option value="published">Publicada</option>
                  <option value="archived">Archivo histórico</option>
                </select>
              </div>
            </div>

            {[["concept", "Concepto"], ["interventions", "Intervenciones"], ["materials", "Materiales y avíos"], ["care", "Cuidados"], ["shipping_info", "Información de envío"]].map(([k, l]) => (
              <div key={k}><Label className={lbl}>{l}</Label><Textarea className={field} rows={2} value={f[k]} onChange={(e) => set(k, e.target.value)} /></div>
            ))}

            {/* Sizes */}
            <div>
              <Label className={lbl}>Talles y medidas reales</Label>
              <div className="space-y-2 mt-2">
                {f.sizes.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Input className={`${field} mt-0 w-24`} value={s.label} placeholder="Talle" onChange={(e) => { const n = [...f.sizes]; n[i] = { ...n[i], label: e.target.value }; set("sizes", n); }} />
                    <Input className={`${field} mt-0 flex-1`} value={s.measurements} placeholder="Medidas reales" onChange={(e) => { const n = [...f.sizes]; n[i] = { ...n[i], measurements: e.target.value }; set("sizes", n); }} />
                    <button onClick={() => set("sizes", f.sizes.filter((_, j) => j !== i))} className="text-[#6E675E] hover:text-[#9E2A2B] px-2"><Trash2 size={16} /></button>
                  </div>
                ))}
                <button data-testid="pe-add-size" onClick={() => set("sizes", [...f.sizes, { label: "", measurements: "" }])} className="dossier-label text-[#8C857B] hover:text-[#F5F4F0] inline-flex items-center gap-1"><Plus size={14} /> Agregar talle</button>
              </div>
            </div>

            {/* Images */}
            <div>
              <Label className={lbl}>Imágenes</Label>
              <div className="flex flex-wrap gap-3 mt-2">
                {f.images.map((img, i) => (
                  <div key={img} className="relative w-20 h-24 border border-[#2A2A2A] overflow-hidden group">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => set("images", f.images.filter((_, j) => j !== i))} className="absolute top-0 right-0 bg-black/70 p-1 text-[#c74446]"><X size={12} /></button>
                  </div>
                ))}
                <button data-testid="pe-upload-image" onClick={() => fileRef.current.click()} disabled={uploading} className="w-20 h-24 border border-dashed border-[#2A2A2A] flex flex-col items-center justify-center text-[#6E675E] hover:border-[#555] gap-1">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  <span className="text-[9px]">subir</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && upload(e.target.files[0], false)} />
              </div>
            </div>

            {/* Video */}
            <div>
              <Label className={lbl}>Video opcional</Label>
              <div className="flex items-center gap-3 mt-2">
                {f.video && <video src={f.video} className="w-28 h-20 object-cover border border-[#2A2A2A]" muted />}
                <button onClick={() => videoRef.current.click()} className="btn-outline-ink px-4 py-2 dossier-label inline-flex items-center gap-2"><Upload size={14} /> {f.video ? "Cambiar" : "Subir video"}</button>
                {f.video && <button onClick={() => set("video", null)} className="text-[#6E675E] hover:text-[#9E2A2B]"><Trash2 size={16} /></button>}
                <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files[0] && upload(e.target.files[0], true)} />
              </div>
            </div>

            {product?.id && <UnitsManager productId={product.id} designCode={f.design_code} token={token} onWaitlistNotified={() => setWlVersion((v) => v + 1)} />}
            {product?.id && <ProductWaitlist productId={product.id} version={wlVersion} />}
          </div>

          <div className="flex gap-3 p-5 border-t border-[#1C1C1C] sticky bottom-0 bg-[#0E0E0E]">
            <button data-testid="pe-save" onClick={save} disabled={saving} className="btn-ink px-7 py-3 dossier-label disabled:opacity-60">{saving ? "Guardando…" : "Guardar pieza"}</button>
            <button onClick={onClose} className="btn-outline-ink px-7 py-3 dossier-label">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnitsManager({ productId, designCode, token, onWaitlistNotified }) {
  const [units, setUnits] = useState([]);
  const [size, setSize] = useState("1");
  const [qty, setQty] = useState(1);
  const [qr, setQr] = useState(null);

  const load = () => api.get(`/admin/products/${productId}/units`).then((r) => setUnits(r.data)).catch(() => {});
  useEffect(() => { load(); }, [productId]);

  const gen = async () => {
    try {
      await api.post(`/admin/products/${productId}/units`, { size, quantity: Number(qty), color: "" });
      toast.success("Unidades generadas");
      load();
      const { data: wl } = await api.get(`/admin/products/${productId}/waitlist`);
      const pending = (wl || []).filter((w) => !w.notified).length;
      if (pending > 0 && window.confirm(`Repusiste stock. Hay ${pending} persona(s) en la lista de espera sin avisar. ¿Les avisamos ahora por email que la pieza volvió?`)) {
        const { data } = await api.post(`/admin/products/${productId}/notify`);
        toast.success(`Avisadas: ${data.sent}`);
        onWaitlistNotified && onWaitlistNotified();
      }
    } catch (e) { toast.error(errMsg(e)); }
  };
  const changeStatus = async (u, status) => {
    try { await api.put(`/admin/units/${u.id}`, { status, note: "cambio manual" }); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const showQr = async (u) => {
    try { const { data } = await api.get(`/admin/units/${u.id}/qr`); setQr(data); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="border-t border-[#1C1C1C] pt-5">
      <div className="flex items-center justify-between mb-3">
        <Label className={lbl}>Unidades físicas · códigos únicos</Label>
        <a href={`${API}/admin/products/${productId}/units/export?`} onClick={(e) => { e.preventDefault(); downloadCsv(productId, designCode, token); }} className="dossier-label text-[#8C857B] hover:text-[#F5F4F0] inline-flex items-center gap-1"><Download size={13} /> Exportar CSV</a>
      </div>
      <div className="flex gap-2 mb-4">
        <Input className={`${field} mt-0 w-24`} value={size} onChange={(e) => setSize(e.target.value)} placeholder="Talle" />
        <Input type="number" className={`${field} mt-0 w-24`} value={qty} onChange={(e) => setQty(e.target.value)} />
        <button data-testid="generate-units" onClick={gen} className="btn-outline-ink px-4 dossier-label inline-flex items-center gap-1"><Plus size={14} /> Generar</button>
      </div>
      <div className="max-h-64 overflow-y-auto no-scrollbar space-y-1.5">
        {units.map((u) => (
          <div key={u.id} className="flex items-center justify-between bg-[#121212] border border-[#1C1C1C] px-3 py-2">
            <div className="font-mono2 text-xs text-[#D8D3CB]">{u.unit_code} <span className="text-[#6E675E]">· T{u.size} · Nº{u.edition_number}</span></div>
            <div className="flex items-center gap-2">
              <select value={u.status} onChange={(e) => changeStatus(u, e.target.value)} className="bg-[#0A0A0A] border border-[#2A2A2A] text-xs text-[#A39B8E] rounded px-2 py-1">
                <option value="disponible">disponible</option>
                <option value="reservada">reservada</option>
                <option value="vendida">vendida</option>
                <option value="retirada">retirada</option>
              </select>
              <button onClick={() => showQr(u)} className="text-[#8C857B] hover:text-[#F5F4F0]"><QrCode size={15} /></button>
            </div>
          </div>
        ))}
        {units.length === 0 && <p className="text-xs text-[#6E675E]">Sin unidades. Generá las primeras.</p>}
      </div>

      {qr && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4" onClick={() => setQr(null)}>
          <div className="bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <img src={qr.qr} alt="QR" className="w-56 h-56 mx-auto" />
            <div className="font-mono2 text-xs text-black mt-3">{qr.unit_code}</div>
            <div className="text-[10px] text-neutral-500 mt-1 max-w-[220px] break-all">{qr.public_url}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductWaitlist({ productId, version }) {
  const [wl, setWl] = useState([]);
  const load = () => api.get(`/admin/products/${productId}/waitlist`).then((r) => setWl(r.data)).catch(() => {});
  useEffect(() => { load(); }, [productId, version]);
  const pending = wl.filter((w) => !w.notified).length;
  const notify = async () => {
    if (!window.confirm(`¿Avisar por email a ${pending} persona(s) que todavía no contactaste que la pieza volvió?`)) return;
    try { const { data } = await api.post(`/admin/products/${productId}/notify`); toast.success(`Emails enviados: ${data.sent}`); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="border-t border-[#1C1C1C] pt-5">
      <div className="flex items-center justify-between mb-3">
        <Label className={lbl}>Lista de espera · "avisame si vuelve"</Label>
        {pending > 0
          ? <button data-testid="notify-product" onClick={notify} className="dossier-label text-[#E6E2DD] hover:text-white">Avisar que volvió ({pending})</button>
          : wl.length > 0 && <span className="dossier-label text-[#72B078]">todas avisadas</span>}
      </div>
      {wl.length === 0 ? <p className="text-xs text-[#6E675E]">Nadie anotado todavía.</p> : (
        <div className="max-h-40 overflow-y-auto no-scrollbar space-y-1.5">
          {wl.map((w) => (
            <div key={w.id} className="flex items-center justify-between bg-[#121212] border border-[#1C1C1C] px-3 py-2 text-xs">
              <span className="text-[#D8D3CB]">{w.name} · {w.email}{w.size ? ` · talle ${w.size}` : ""}</span>
              {w.notified && <span className="dossier-label text-[#72B078]">avisada</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function downloadCsv(productId, designCode, token) {
  try {
    const res = await fetch(`${API}/admin/products/${productId}/units/export`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `unidades_${designCode}.csv`; a.click();
    URL.revokeObjectURL(url);
  } catch { toast.error("No se pudo exportar"); }
}
