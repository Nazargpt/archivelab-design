import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import api from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { setSeo } from "@/lib/seo";

const BRAND = process.env.REACT_APP_BACKEND_URL;

export default function Home() {
  const [products, setProducts] = useState([]);
  const [home, setHome] = useState({});

  useEffect(() => {
    setSeo({ title: "", description: "Un museo de piezas de archivo. Moda de autor de Camila Guerra en ediciones limitadas. Construí tu propio archivo.", path: "/" });
    api.get("/products").then((r) => setProducts(r.data.slice(0, 6))).catch(() => {});
    api.get("/content/home").then((r) => setHome(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      {/* HERO */}
      <section className="relative h-[92vh] min-h-[600px] w-full overflow-hidden">
        <video
          data-testid="hero-video"
          className="absolute inset-0 w-full h-full object-cover"
          src={home.hero_video || `${BRAND}/brand/hero.mp4`}
          autoPlay muted loop playsInline poster={`${BRAND}/brand/img1.jpeg`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/50 to-[#0A0A0A]/30" />
        <div className="relative z-10 h-full flex flex-col justify-end px-4 sm:px-8 lg:px-16 pb-16 lg:pb-24">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}>
            <div className="dossier-label text-[#8C857B] mb-4">Archivo → Pieza → Expediente → Edición → Liberación</div>
            <h1 className="font-display font-extrabold uppercase tracking-tight text-[#F5F4F0] text-4xl sm:text-6xl lg:text-7xl leading-[0.95] max-w-4xl">
              {home.hero_title || "Construí tu propio archivo"}
            </h1>
            <p className="mt-5 text-[#A39B8E] text-base sm:text-lg max-w-xl leading-relaxed">
              {home.hero_subtitle || "No necesitás más ropa. Necesitás mejores piezas. Moda de autor en ediciones limitadas, pensada para quedarse."}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/archivo" data-testid="explore-archive-cta" className="btn-ink px-8 py-4 inline-flex items-center gap-3 dossier-label">
                Explorar el archivo <ArrowRight size={16} />
              </Link>
              <Link to="/camila-guerra" data-testid="vip-cta" className="btn-outline-ink px-8 py-4 inline-flex items-center gap-3 dossier-label">
                Camila Guerra VIP
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* MANIFESTO */}
      <section className="px-4 sm:px-8 lg:px-16 py-20 lg:py-28 border-b border-[#161616]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5">
            <div className="dossier-label text-[#6E675E] mb-4">El concepto</div>
            <h2 className="font-display font-bold uppercase tracking-tight text-3xl lg:text-4xl text-[#F5F4F0] leading-tight">
              Un museo de piezas de archivo
            </h2>
          </div>
          <div className="lg:col-span-7 text-[#A39B8E] text-base lg:text-lg leading-relaxed space-y-4">
            <p>{home.manifesto || "Archive Lab funciona como un museo. Cada drop es una liberación. Cada prenda tiene su propia identidad. Cada edición es limitada. Cada adquisición pasa a formar parte del archivo personal de quien la compra."}</p>
            <p className="font-script text-3xl text-[#8C857B]">Una pieza puede cambiarlo todo.</p>
          </div>
        </div>
      </section>

      {/* LATEST PIECES */}
      <section className="px-4 sm:px-8 lg:px-16 py-16 lg:py-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="dossier-label text-[#6E675E] mb-2">Última liberación</div>
            <h2 className="font-display font-bold uppercase tracking-tight text-3xl lg:text-4xl text-[#F5F4F0]">Piezas en el archivo</h2>
          </div>
          <Link to="/archivo" className="dossier-label text-[#8C857B] hover:text-[#F5F4F0] transition-colors inline-flex items-center gap-2">
            Ver todo <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {products.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
        </div>
      </section>

      {/* BELLEZA DE LOS OPUESTOS */}
      <section className="px-4 sm:px-8 lg:px-16 py-20 border-t border-[#161616]">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          {["Clásico + inesperado", "Formal + rebelde", "Femenino + poderoso", "Minimalista + statement", "Sofisticado + canchero"].map((t) => (
            <div key={t} className="museum-frame p-6 hover-lift">
              <span className="font-display font-semibold uppercase tracking-tight text-[#E6E2DD] text-sm">{t}</span>
            </div>
          ))}
        </div>
        <p className="text-center font-script text-3xl text-[#8C857B] mt-10">La contradicción es parte de la identidad.</p>
      </section>
    </div>
  );
}
