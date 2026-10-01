import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import api from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { useAuth } from "@/context/AuthContext";

const BRAND = process.env.REACT_APP_BACKEND_URL;

export default function VIP() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.get("/products", { params: { vip: true } }).then((r) => setProducts(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <section className="relative h-[55vh] min-h-[420px] overflow-hidden">
        <img src={`${BRAND}/brand/img1.jpeg`} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/70 to-[#0A0A0A]/40" />
        <div className="relative z-10 h-full flex flex-col justify-end px-4 sm:px-8 lg:px-16 pb-14">
          <div className="dossier-label text-[#9E2A2B] mb-3">Archivo privado</div>
          <h1 className="font-display font-extrabold uppercase tracking-tight text-4xl lg:text-6xl text-[#F5F4F0]">Camila Guerra</h1>
          <p className="font-script text-3xl text-[#8C857B] mt-3">No todo el mundo puede tenerla.</p>
        </div>
      </section>

      <section className="px-4 sm:px-8 lg:px-16 py-12 lg:py-16">
        {!user ? (
          <div className="museum-frame p-10 lg:p-16 text-center max-w-2xl mx-auto">
            <Lock className="mx-auto text-[#8C857B] mb-5" size={28} />
            <h2 className="font-display font-bold uppercase tracking-tight text-2xl text-[#F5F4F0]">Sección reservada a miembros del archivo</h2>
            <p className="text-[#A39B8E] mt-4 leading-relaxed">Las piezas de Camila Guerra son colecciones super reducidas, abiertas solo a clientas registradas. Ingresá o creá tu cuenta para acceder.</p>
            <div className="flex gap-3 justify-center mt-7">
              <Link to="/ingresar" data-testid="vip-login" className="btn-ink px-7 py-3 dossier-label">Ingresar</Link>
              <Link to="/ingresar?modo=registro" data-testid="vip-register" className="btn-outline-ink px-7 py-3 dossier-label">Crear cuenta</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="dossier-label text-[#6E675E] mb-2">Stock muy limitado</div>
                <h2 className="font-display font-bold uppercase tracking-tight text-3xl text-[#F5F4F0]">Piezas exclusivas</h2>
              </div>
              <span className="dossier-label text-[#8C857B]">Hola, {user.name?.split(" ")[0]}</span>
            </div>
            {products.length === 0 ? (
              <p className="py-20 text-center dossier-label text-[#6E675E]">Todavía no hay piezas liberadas en esta sección.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {products.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
