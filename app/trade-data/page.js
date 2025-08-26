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
      </Header>
      <DynamicTable />
    </LayoutWrapper>
  );
}

const Header = styled.div`
  padding: 2rem 0rem;
  h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #242424ff;
    text-align: center;
    margin: 0;
  }
`;
