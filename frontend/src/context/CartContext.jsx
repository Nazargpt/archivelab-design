import React, { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("archive_cart") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("archive_cart", JSON.stringify(items));
  }, [items]);

  const addItem = (item) => {
    // item: { key, product_id, name, size, price, image, design_code }
    setItems((prev) => {
      if (prev.find((i) => i.key === item.key)) return prev;
      return [...prev, item];
    });
  };
  const removeItem = (key) => setItems((prev) => prev.filter((i) => i.key !== key));
  const clear = () => setItems([]);
  const total = items.reduce((s, i) => s + (i.price || 0), 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clear, total, count: items.length }}>
      {children}
    </CartContext.Provider>
  );
};
