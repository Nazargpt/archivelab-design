import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("archive_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const formatARS = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

export const errMsg = (e, fallback = "Algo salió mal. Probá de nuevo.") => {
  const d = e?.response?.data?.detail;
  if (!d) return e?.message || fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return String(d);
};

export const CATEGORIES = [
  { key: "denim", label: "Denim Intervenido" },
  { key: "intima", label: "Íntima / Corsetería" },
  { key: "accesorios", label: "Accesorios" },
  { key: "carteras", label: "Carteras / Bolsos" },
];

export default api;
