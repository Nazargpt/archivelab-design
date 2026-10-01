import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import "@/index.css";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Home from "@/pages/Home";
import Archive from "@/pages/Archive";
import Expediente from "@/pages/Expediente";
import VIP from "@/pages/VIP";
import Events from "@/pages/Events";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import DemoCheckout from "@/pages/DemoCheckout";
import PaymentResult from "@/pages/PaymentResult";
import MiArchivo from "@/pages/MiArchivo";
import PublicPiece from "@/pages/PublicPiece";
import Certificate from "@/pages/Certificate";
import Auth from "@/pages/Auth";
import AuthCallback from "@/pages/AuthCallback";
import Legal from "@/pages/Legal";
import Admin from "@/pages/admin/Admin";

function AppRouter() {
  const location = useLocation();
  // Handle Emergent Google OAuth callback before anything else.
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Layout><Home /></Layout>} />
      <Route path="/archivo" element={<Layout><Archive /></Layout>} />
      <Route path="/pieza-expediente/:id" element={<Layout><Expediente /></Layout>} />
      <Route path="/camila-guerra" element={<Layout><VIP /></Layout>} />
      <Route path="/eventos" element={<Layout><Events /></Layout>} />
      <Route path="/carrito" element={<Layout><Cart /></Layout>} />
      <Route path="/checkout" element={<Layout><Checkout /></Layout>} />
      <Route path="/checkout/demo/:orderId" element={<Layout><DemoCheckout /></Layout>} />
      <Route path="/payment-result" element={<Layout><PaymentResult /></Layout>} />
      <Route path="/pieza/:code" element={<Layout><PublicPiece /></Layout>} />
      <Route path="/certificado/:code" element={<Layout><Certificate /></Layout>} />
      <Route path="/ingresar" element={<Layout><Auth /></Layout>} />
      <Route path="/contacto" element={<Layout><Legal kind="contacto" /></Layout>} />
      <Route path="/legal/privacidad" element={<Layout><Legal kind="privacidad" /></Layout>} />
      <Route path="/legal/condiciones" element={<Layout><Legal kind="condiciones" /></Layout>} />
      <Route path="/legal/cambios" element={<Layout><Legal kind="cambios" /></Layout>} />
      <Route path="/mi-archivo" element={<ProtectedRoute><Layout><MiArchivo /></Layout></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><Layout><Admin /></Layout></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
