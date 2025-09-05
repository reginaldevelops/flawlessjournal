"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, BarChart2, List, PenSquare, Book } from "lucide-react";

export default function LayoutHeader() {
  const [open, setOpen] = useState(false);

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
          <Link
            href="/dashboard"
            className="hover:text-[#00c8ff] flex flex-col items-center"
          >
            <BarChart2 size={24} />
          </Link>
          <Link
            href="/trades"
            className="hover:text-[#00c8ff] flex flex-col items-center"
          >
            <List size={24} />
          </Link>
          <Link
            href="/journal"
            className="hover:text-[#00c8ff] flex flex-col items-center"
          >
            <PenSquare size={24} />
          </Link>
          <Link
            href="/notebook"
            className="hover:text-[#00c8ff] flex flex-col items-center"
          >
            <Book size={24} />
          </Link>
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
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="text-gray-200 hover:text-[#00c8ff] flex flex-col items-center gap-1"
            >
              <BarChart2 size={22} />
              <span className="text-xs">Dash</span>
            </Link>
            <Link
              href="/trades"
              onClick={() => setOpen(false)}
              className="text-gray-200 hover:text-[#00c8ff] flex flex-col items-center gap-1"
            >
              <List size={22} />
              <span className="text-xs">Trades</span>
            </Link>
            <Link
              href="/journal"
              onClick={() => setOpen(false)}
              className="text-gray-200 hover:text-[#00c8ff] flex flex-col items-center gap-1"
            >
              <PenSquare size={22} />
              <span className="text-xs">Journal</span>
            </Link>
            <Link
              href="/notebook"
              onClick={() => setOpen(false)}
              className="text-gray-200 hover:text-[#00c8ff] flex flex-col items-center gap-1"
            >
              <Book size={22} />
              <span className="text-xs">Notebook</span>
            </Link>
          </div>
        )}
      </header>

      {/* Content wrapper (zorg dat er ruimte is naast sidebar op desktop) */}
      <main className="md:ml-16 pt-16 md:pt-0">
        {/* hier komt je page content */}
      </main>
    </>
  );
}
