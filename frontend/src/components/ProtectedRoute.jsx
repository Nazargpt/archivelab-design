import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="dossier-label text-[#6E675E] animate-pulse">verificando acceso…</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/ingresar" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
};

export default ProtectedRoute;
