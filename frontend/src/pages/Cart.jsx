import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, ArrowRight, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatARS } from "@/lib/api";

export default function Cart() {
  const { items, removeItem, total } = useCart();
  const navigate = useNavigate();

  return (
    <div className="px-4 sm:px-8 lg:px-16 py-12 lg:py-16 max-w-5xl mx-auto">
      <div className="dossier-label text-[#6E675E] mb-3">Tu selección</div>
      <h1 className="font-display font-extrabold uppercase tracking-tight text-4xl lg:text-5xl text-[#F5F4F0] mb-10">Carrito</h1>

      {items.length === 0 ? (
        <div className="museum-frame p-16 text-center">
          <ShoppingBag className="mx-auto text-[#8C857B] mb-4" size={28} />
          <p className="font-display uppercase tracking-tight text-xl text-[#8C857B]">Tu carrito está vacío</p>
          <Link to="/archivo" data-testid="cart-empty-explore" className="btn-ink px-7 py-3 dossier-label inline-flex mt-6">Explorar el archivo</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 flex flex-col gap-4">
            {items.map((it) => (
              <div key={it.key} data-testid={`cart-item-${it.key}`} className="museum-frame flex gap-4 p-4">
                <div className="w-24 h-28 bg-[#161616] overflow-hidden shrink-0">
                  {it.image && <img src={it.image} alt={it.name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1">
                  <div className="dossier-label text-[#6E675E]">{it.design_code} · talle {it.size}</div>
                  <h3 className="font-display font-bold uppercase tracking-tight text-[#F5F4F0]">{it.name}</h3>
                  <div className="text-[#E6E2DD] mt-1">{formatARS(it.price)}</div>
                </div>
                <button data-testid={`cart-remove-${it.key}`} onClick={() => removeItem(it.key)} className="text-[#6E675E] hover:text-[#9E2A2B] self-start transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          <div className="museum-frame p-6 h-fit">
            <div className="dossier-label text-[#6E675E] mb-4">Resumen</div>
            <div className="flex justify-between text-[#A39B8E] text-sm mb-2">
              <span>Piezas</span><span>{items.length}</span>
            </div>
            <div className="flex justify-between text-[#F5F4F0] text-lg font-medium border-t border-[#2A2A2A] pt-3 mt-3">
              <span>Total</span><span data-testid="cart-total">{formatARS(total)}</span>
            </div>
            <button data-testid="checkout-button" onClick={() => navigate("/checkout")} className="btn-ink w-full py-4 mt-6 dossier-label inline-flex items-center justify-center gap-2">
              Ir al checkout <ArrowRight size={16} />
            </button>
            <p className="text-xs text-[#6E675E] mt-3 text-center">Pago con Mercado Pago · envío a todo el país</p>
          </div>
        </div>
      )}
    </div>
  );
}
