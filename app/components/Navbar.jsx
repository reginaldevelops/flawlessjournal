"use client";
import styled from "styled-components";

export default function Navbar({ darkMode, setDarkMode }) {
  return (
    <Nav>
      <Title>Flawless Journal</Title>
      <Right>
        <ToggleBtn onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "🌙" : "☀️"}
        </ToggleBtn>
      </Right>
    </Nav>
  );
}

const Nav = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  border-bottom: 1px solid #ddd;
  background: ${(p) => p.theme.background};
  color: ${(p) => p.theme.foreground};
`;

const Title = styled.h1`
  font-size: 1.5rem;
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const ToggleBtn = styled.button`
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: ${(p) => p.theme.foreground};
`;
