"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, BarChart2, List, PenSquare, Book } from "lucide-react";

export default function LayoutHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", icon: <BarChart2 size={24} />, label: "Dash" },
    { href: "/trades", icon: <List size={24} />, label: "Trades" },
    { href: "/journal", icon: <PenSquare size={24} />, label: "Journal" },
    { href: "/notebook", icon: <Book size={24} />, label: "Notebook" },
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-16 bg-[#0b0b0d] border-r border-[#222] flex-col items-center py-6 space-y-8">
        {/* Logo boven */}
        <Link
          href="/"
          className="text-white font-bold text-xl hover:text-[#00c8ff]"
        >
          FJ
        </Link>

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
      </aside>

      {/* Mobile top header */}
      <header className="md:hidden bg-[#0b0b0d] border-b border-[#222] w-full fixed top-0 left-0 z-50">
        <div className="flex justify-between items-center px-6 py-4">
          {/* Logo */}
          <div className="text-white font-bold text-lg">
            <Link href="/">FJ</Link>
          </div>

          {/* Toggle */}
          <button
            onClick={() => setOpen(!open)}
            className="text-white focus:outline-none"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile dropdown (icon-only) */}
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
          </div>
        )}
      </header>

      {/* Content wrapper (ruimte naast sidebar op desktop) */}
      <main className="md:ml-16 pt-16 md:pt-0">
        {/* hier komt je page content */}
      </main>
    </>
  );
}
