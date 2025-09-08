"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import {
  Menu,
  X,
  BarChart2,
  List,
  PenSquare,
  Book,
  LogOut,
  PieChart,
} from "lucide-react";

export default function LayoutHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: "/dashboard", icon: <BarChart2 size={24} />, label: "Dash" },
    { href: "/trades", icon: <List size={24} />, label: "Trades" },
    { href: "/journal", icon: <PenSquare size={24} />, label: "Journal" },
    { href: "/notebook", icon: <Book size={24} />, label: "Notebook" },
    { href: "/analytics", icon: <PieChart size={24} />, label: "Analytics" },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-16 bg-[#0b0b0d] border-r border-[#222] flex-col items-center py-6 space-y-8">
        {/* Logo boven */}
        <span
          href="/"
          className="text-white font-bold text-xl hover:text-[#00c8ff]"
        >
          FJ
        </span>

        {/* Menu items als icons */}
        <nav className="flex flex-col items-center gap-6 mt-10 text-gray-200">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center ${
                  active ? "text-[#00c8ff]" : "hover:text-[#00c8ff]"
                }`}
              >
                {item.icon}
              </Link>
            );
          })}
        </nav>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="mt-auto text-gray-400 hover:text-red-500"
        >
          <LogOut size={22} />
        </button>
      </aside>

      {/* Mobile top header */}
      <header className="md:hidden bg-[#0b0b0d] border-b border-[#222] w-full fixed top-0 left-0 z-50">
        <div className="flex justify-between items-center px-6 py-4">
          {/* Logo */}
          <div className="text-white font-bold text-lg">
            <span>FJ</span>
          </div>

          {/* Toggle */}
          <button
            onClick={() => setOpen(!open)}
            className="text-white focus:outline-none"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div className="bg-[#111] border-t border-[#333] flex flex-row justify-around py-4">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex flex-col items-center gap-1 px-2 ${
                    active
                      ? "text-[#00c8ff]"
                      : "text-gray-200 hover:text-[#00c8ff]"
                  }`}
                >
                  {item.icon}
                  <span className="text-xs">{item.label}</span>
                </Link>
              );
            })}

            {/* Logout mobile */}
            <button
              onClick={() => {
                setOpen(false);
                handleLogout();
              }}
              className="flex flex-col items-center gap-1 px-2 text-gray-200 hover:text-red-500"
            >
              <LogOut size={24} />
              <span className="text-xs">Logout</span>
            </button>
          </div>
        )}
      </header>

      {/* Content wrapper */}
      <main className="md:ml-16 pt-16 md:pt-0">{/* page content */}</main>
    </>
  );
}
