// app/components/LayoutWrapper.js
"use client";

import styled from "styled-components";
import Header from "./Header";

export default function LayoutWrapper({ children }) {
  return (
    <Container>
      <Header /> {/* ⬅ navigatiebalk bovenaan */}
      <Content>{children}</Content>
    </Container>
  );
}

/* ---------------- styled ---------------- */
const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #dcd9deff, #d3d4d7ff);
  color: #000000ff;
`;

const Content = styled.main`
  width: 100%;
`;
