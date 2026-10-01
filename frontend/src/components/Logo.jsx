import React from "react";
import { Link } from "react-router-dom";

export const Logo = ({ className = "", size = "text-2xl", onClick }) => (
  <Link to="/" onClick={onClick} data-testid="brand-logo" className={`inline-flex items-baseline gap-1 select-none ${className}`}>
    <span className={`font-display font-extrabold tracking-tight ${size} text-[#F5F4F0] leading-none`}>ARCHIVE</span>
    <span className="font-script text-[#8C857B] leading-none" style={{ fontSize: "1.6em" }}>lab</span>
  </Link>
);

export default Logo;
