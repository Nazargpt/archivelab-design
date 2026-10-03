import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShoppingBag, Menu, X, User, Search } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { CATEGORIES } from "@/lib/api";

const NAV = [
  { to: "/archivo", label: "Catálogo" },
  { to: "/liberaciones", label: "Liberaciones" },
  { to: "/eventos", label: "Eventos" },
  { to: "/camila-guerra", label: "Camila Guerra" },
  { to: "/mi-archivo", label: "Mi Archivo" },
];

export const Layout = ({ children }) => {
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A0A] grain">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/70 border-b border-[#1C1C1C]">
        <div className="px-4 sm:px-8 lg:px-16 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden lg:flex items-center gap-7">
              {NAV.map((n) => (
                <Link key={n.to} to={n.to} data-testid={`nav-${n.to.replace(/\//g, "")}`}
                  className={`dossier-label hover:text-[#F5F4F0] transition-colors ${loc.pathname === n.to ? "text-[#F5F4F0]" : "text-[#8C857B]"}`}>
                  {n.label}
                </Link>
              ))}
              {user?.role === "admin" && (
                <Link to="/admin" data-testid="nav-admin" className="dossier-label text-[#9E2A2B] hover:text-[#c74446] transition-colors">Panel</Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-5">
            <button data-testid="nav-cart" onClick={() => navigate("/carrito")} className="relative text-[#F5F4F0] hover:text-[#8C857B] transition-colors">
              <ShoppingBag size={20} />
              {count > 0 && (
                <span data-testid="cart-count" className="absolute -top-2 -right-2 bg-[#E6E2DD] text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{count}</span>
              )}
            </button>
            <button data-testid="nav-account" onClick={() => navigate(user ? "/mi-archivo" : "/ingresar")} className="hidden sm:block text-[#F5F4F0] hover:text-[#8C857B] transition-colors">
              <User size={20} />
            </button>
            <button data-testid="nav-mobile-toggle" onClick={() => setOpen(!open)} className="lg:hidden text-[#F5F4F0]">
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {open && (
          <div className="lg:hidden border-t border-[#1C1C1C] px-4 py-4 flex flex-col gap-4 bg-black/95">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} data-testid={`mnav-${n.to.replace(/\//g, "")}`} className="dossier-label text-[#A39B8E]">{n.label}</Link>
            ))}
            {user?.role === "admin" && <Link to="/admin" onClick={() => setOpen(false)} className="dossier-label text-[#9E2A2B]">Panel</Link>}
            <Link to={user ? "/mi-archivo" : "/ingresar"} onClick={() => setOpen(false)} className="dossier-label text-[#A39B8E]">{user ? "Mi cuenta" : "Ingresar"}</Link>
          </div>
        )}
      </header>

      <main className="flex-1 relative z-10">{children}</main>

      <footer className="border-t border-[#1C1C1C] mt-24 px-4 sm:px-8 lg:px-16 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <Logo size="text-3xl" />
            <p className="font-script text-2xl text-[#8C857B] mt-4 max-w-md">Construí tu propio archivo.</p>
            <p className="text-sm text-[#6E675E] mt-4 max-w-sm leading-relaxed">No creamos prendas para llenar tu closet. Creamos piezas para que se queden.</p>
          </div>
          <div>
            <div className="dossier-label text-[#6E675E] mb-4">Archivo</div>
            <div className="flex flex-col gap-2">
              {CATEGORIES.map((c) => (
                <Link key={c.key} to={`/archivo?cat=${c.key}`} className="text-sm text-[#A39B8E] hover:text-[#F5F4F0] transition-colors">{c.label}</Link>
              ))}
              <Link to="/camila-guerra" className="text-sm text-[#A39B8E] hover:text-[#F5F4F0] transition-colors">Camila Guerra VIP</Link>
            </div>
          </div>
          <div>
            <div className="dossier-label text-[#6E675E] mb-4">Marca</div>
            <div className="flex flex-col gap-2">
              <Link to="/contacto" className="text-sm text-[#A39B8E] hover:text-[#F5F4F0] transition-colors">Contacto</Link>
              <Link to="/legal/privacidad" className="text-sm text-[#A39B8E] hover:text-[#F5F4F0] transition-colors">Privacidad</Link>
              <Link to="/legal/condiciones" className="text-sm text-[#A39B8E] hover:text-[#F5F4F0] transition-colors">Condiciones de compra</Link>
              <Link to="/legal/cambios" className="text-sm text-[#A39B8E] hover:text-[#F5F4F0] transition-colors">Cambios y devoluciones</Link>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-[#161616] flex flex-col sm:flex-row justify-between gap-3">
          <span className="dossier-label text-[#4A453F]">© {new Date().getFullYear()} Archive Lab · Buenos Aires</span>
          <span className="dossier-label text-[#4A453F]">Diseños de autor · Cami Guerra</span>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
