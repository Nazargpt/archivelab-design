import React, { useEffect, useState } from "react";
import api from "@/lib/api";

const BRAND = process.env.REACT_APP_BACKEND_URL;

const CONTENT = {
  contacto: {
    title: "Contacto",
    render: (s) => (
      <div className="space-y-4 text-[#A39B8E] leading-relaxed">
        <p>Escribinos para consultas sobre piezas, encargos o la sección Camila Guerra.</p>
        <ul className="space-y-2">
          <li><span className="dossier-label text-[#6E675E] mr-2">Email</span>{s?.contact_email || "— (pendiente de cargar)"}</li>
          <li><span className="dossier-label text-[#6E675E] mr-2">WhatsApp</span>{s?.contact_whatsapp || "— (pendiente de cargar)"}</li>
          <li><span className="dossier-label text-[#6E675E] mr-2">Instagram</span>@{s?.instagram || "archivelab"}</li>
          {s?.address && <li><span className="dossier-label text-[#6E675E] mr-2">Dirección</span>{s.address}</li>}
        </ul>
        <p className="font-script text-2xl text-[#8C857B] pt-4">A brillar, amores.</p>
      </div>
    ),
  },
};

export default function Legal({ kind }) {
  const [settings, setSettings] = useState(null);
  const [legal, setLegal] = useState({});

  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
    api.get("/content/legal").then((r) => setLegal(r.data)).catch(() => {});
  }, []);

  const map = {
    privacidad: { title: "Privacidad", body: legal.privacy },
    condiciones: { title: "Condiciones de compra", body: legal.terms },
    cambios: { title: "Cambios y devoluciones", body: legal.returns },
  };

  const isContacto = kind === "contacto";
  const page = isContacto ? CONTENT.contacto : map[kind];

  return (
    <div className="px-4 sm:px-8 lg:px-16 py-12 lg:py-20 max-w-3xl mx-auto">
      <div className="dossier-label text-[#6E675E] mb-3">Archive Lab</div>
      <h1 className="font-display font-extrabold uppercase tracking-tight text-4xl lg:text-5xl text-[#F5F4F0] mb-8">{page?.title}</h1>
      {isContacto ? page.render(settings) : (
        page?.body ? (
          <div className="text-[#A39B8E] leading-relaxed whitespace-pre-line">{page.body}</div>
        ) : (
          <div className="museum-frame p-8">
            <p className="text-[#8C857B]">Este texto está pendiente de cargar. La marca puede completarlo desde el panel de administración.</p>
            <p className="dossier-label text-[#4A453F] mt-3">Campo configurable · no se inventan textos legales</p>
          </div>
        )
      )}
    </div>
  );
}
