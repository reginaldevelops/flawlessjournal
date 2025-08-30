"use client";

import Link from "next/link";
import { useState } from "react";
import styled from "styled-components";
import { Menu, X } from "lucide-react";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <Wrapper>
      <TextWrapper>
        <Logo>
          <Link href="/">Trade Journal</Link>
        </Logo>

        {/* desktop menu */}
        <Nav>
          <Link href="/dashboard">Dash</Link>
          <Link href="/trades">Trade Data</Link>
          <Link href="/journal">Journal</Link>
        </Nav>

        {/* mobile toggle */}
        <MobileToggle onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </MobileToggle>

        {/* mobile dropdown */}
        {open && (
          <MobileMenu>
            <Link href="/dashboard" onClick={() => setOpen(false)}>
              Home
            </Link>
            <Link href="/trade-data" onClick={() => setOpen(false)}>
              Trade Data
            </Link>
            <Link href="/journal" onClick={() => setOpen(false)}>
              Journal
            </Link>
          </MobileMenu>
        )}
      </TextWrapper>
    </Wrapper>
  );
}

/* ---------------- styled ---------------- */
const Wrapper = styled.header`
  background: #0b0b0d;
  border-bottom: 1px solid #222;
  position: relative;
  width: 100%;
`;

const TextWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  position: relative;
  width: 100%;
  max-width: 1256px;
  margin: auto;
`;

const Logo = styled.div`
  font-size: 1.2rem;
  font-weight: 700;
  color: #fff;

  a {
    text-decoration: none;
    color: inherit;
  }
`;

const Nav = styled.nav`
  display: flex;
  gap: 1.5rem;

  a {
    color: #e5e7eb;
    text-decoration: none;
    font-weight: 500;
    &:hover {
      color: #00c8ff;
    }
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const MobileToggle = styled.button`
  display: none;
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;

  @media (max-width: 768px) {
    display: block;
  }
`;

const MobileMenu = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  background: #111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  a {
    color: #e5e7eb;
    text-decoration: none;
    &:hover {
      color: #00c8ff;
    }
  }
`;
