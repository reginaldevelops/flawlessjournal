"use client";

import styled from "styled-components";

export default function Navbar() {
  return (
    <NavBar>
      <Logo>Flawless Journal</Logo>
    </NavBar>
  );
}

const NavBar = styled.div`
  width: 100%;
  background: #1976d2;
  padding: 1rem 2rem;
  color: white;
  font-weight: bold;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
`;

const Logo = styled.div`
  font-family: "Segoe UI", sans-serif;
  letter-spacing: 0.5px;
`;
