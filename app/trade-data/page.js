"use client";

import DynamicTable from "../components/DynamicTable";
import LayoutWrapper from "../components/LayoutWrapper";
import Link from "next/link";
import styled from "styled-components";

export default function TradeDataPage() {
  return (
    <LayoutWrapper>
      <Header>
        <h1>📑 Trade Data</h1>
        <StyledLink href="/">⬅️ Terug naar Home</StyledLink>
      </Header>
      <DynamicTable />
    </LayoutWrapper>
  );
}

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;

  h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: #111;
  }
`;

const StyledLink = styled(Link)`
  padding: 0.5rem 1rem;
  border-radius: 6px;
  background: #0ea5e9;
  color: #fff;
  text-decoration: none;
  font-size: 0.9rem;

  &:hover {
    background: #0284c7;
  }
`;
