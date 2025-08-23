"use client";

import Link from "next/link";
import LayoutWrapper from "./components/LayoutWrapper";
import styled, { keyframes } from "styled-components";

export default function HomePage() {
  return (
    <LayoutWrapper>
      <Hero>
        <ButtonBar>
          <StyledLink href="/trade-data">Continue</StyledLink>
        </ButtonBar>
      </Hero>
    </LayoutWrapper>
  );
}

/* ----- styles ----- */
const Hero = styled.div`
  height: calc(100vh);
  display: flex;
  align-items: flex-end; /* knop onderaan */
  justify-content: center;
  background: url("/flawless-logo.png") no-repeat center center;
  background-size: cover;
  position: relative;
`;

const ButtonBar = styled.div`
  margin-bottom: 3rem; /* afstand van onderkant */
`;

const glitch = keyframes`
  0% { text-shadow: 2px 0 #0ea5e9, -2px 0 #ff0080; }
  20% { text-shadow: -2px 0 #0ea5e9, 2px 0 #ff0080; }
  40% { text-shadow: 2px 0 #ff0080, -2px 0 #0ea5e9; }
  60% { text-shadow: -2px 0 #ff0080, 2px 0 #0ea5e9; }
  80% { text-shadow: 2px 0 #0ea5e9, -2px 0 #ff0080; }
  100% { text-shadow: none; }
`;

const StyledLink = styled(Link)`
  padding: 1rem 2.5rem;
  border: 2px solid #0ea5e9;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-weight: 700;
  font-size: 1.2rem;
  letter-spacing: 1px;
  text-decoration: none;
  position: relative;
  box-shadow:
    0 0 12px rgba(14, 165, 233, 0.6),
    0 0 6px rgba(255, 0, 128, 0.5);
  transition: all 0.25s ease;

  &:hover {
    animation: ${glitch} 0.6s infinite;
    border-color: #ff0080;
    box-shadow:
      0 0 16px rgba(255, 0, 128, 0.8),
      0 0 8px rgba(14, 165, 233, 0.8);
    transform: scale(1.05);
  }
`;
