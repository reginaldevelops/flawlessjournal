"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, BarChart2, List, PenSquare, Book } from "lucide-react";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-[#0b0b0d] border-b border-[#222] relative w-full">
      <div className="flex justify-between items-center px-8 py-4 relative w-full max-w-[1256px] mx-auto">
        {/* Logo */}
        <div className="text-white font-bold text-[1.2rem]">
          <Link href="/" className="no-underline text-inherit">
            FJ
          </Link>
        </div>

        {/* Desktop nav with separators */}
        <nav className="hidden md:flex items-center text-gray-200 font-medium">
          <Link href="/dashboard" className="hover:text-[#00c8ff]">
            Dash
          </Link>
          <span className="px-3 text-gray-500">|</span>
          <Link href="/trades" className="hover:text-[#00c8ff]">
            Trades
          </Link>
          <span className="px-3 text-gray-500">|</span>
          <Link href="/journal" className="hover:text-[#00c8ff]">
            Journal
          </Link>
          <span className="px-3 text-gray-500">|</span>
          <Link href="/notebook" className="hover:text-[#00c8ff]">
            Notebook
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="block md:hidden text-white"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Mobile dropdown */}
        {open && (
          <div className="absolute top-full left-0 bg-[#111] border border-[#333] p-4 flex flex-row w-full divide-x divide-gray-700">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="text-gray-200 hover:text-[#00c8ff] px-2 flex-1 flex flex-col items-center gap-1"
            >
              <BarChart2 size={20} />
              <span>Dash</span>
            </Link>
            <Link
              href="/trades"
              onClick={() => setOpen(false)}
              className="text-gray-200 hover:text-[#00c8ff] px-2 flex-1 flex flex-col items-center gap-1"
            >
              <List size={20} />
              <span>Trades</span>
            </Link>
            <Link
              href="/journal"
              onClick={() => setOpen(false)}
              className="text-gray-200 hover:text-[#00c8ff] px-2 flex-1 flex flex-col items-center gap-1"
            >
              <PenSquare size={20} />
              <span>Journal</span>
            </Link>
            <Link
              href="/notebook"
              onClick={() => setOpen(false)}
              className="text-gray-200 hover:text-[#00c8ff] px-2 flex-1 flex flex-col items-center gap-1"
            >
              <Book size={20} />
              <span>Notebook</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
