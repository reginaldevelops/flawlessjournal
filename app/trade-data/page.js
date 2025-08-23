"use client";

import DynamicTable from "../components/DynamicTable";
import LayoutWrapper from "../components/LayoutWrapper";
import Link from "next/link";
import styled from "styled-components";
import { ArrowLeft } from "lucide-react";

export default function TradeDataPage() {
  return (
    <LayoutWrapper>
      <Header>
        <h1>Trade Data</h1>
        <StyledLink href="/">
          <ArrowLeft size={20} /> Back to Home
        </StyledLink>
      </Header>
      <DynamicTable />
    </LayoutWrapper>
  );
}

const Header = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  margin-bottom: 2rem;

  h1 {
    grid-column: 2; /* titel altijd in de middelste kolom */
    font-size: 1.5rem;
    font-weight: 700;
    color: #111;
    text-align: center;
    margin: 0;
  }
`;

const StyledLink = styled(Link)`
  grid-column: 1; /* link altijd links */
  justify-self: start;

  display: inline-flex;
  align-items: center;
  gap: 0.4rem;

  padding: 0.4rem 0.8rem;
  border-radius: 6px;

  background: #f9fafb;
  border: 1px solid #e5e7eb;

  color: #374151;
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;

  transition: all 0.2s ease;

  &:hover {
    background: #f3f4f6;
    color: #0ea5e9;
    border-color: #0ea5e9;
  }
`;
