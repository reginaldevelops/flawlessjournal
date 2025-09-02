// app/components/LayoutWrapper.js
"use client";

import styled from "styled-components";
import Header from "./Header";

export default function LayoutWrapper({ children }) {
  return (
    <Container>
      <Content>{children}</Content>
    </Container>
  );
}

/* ---------------- styled ---------------- */
const Container = styled.div`
  min-height: 96vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(120deg, #e1c4f4ff, #a8c5ffff);
  color: #000000ff;
`;

const Content = styled.main`
  width: 100%;
`;
