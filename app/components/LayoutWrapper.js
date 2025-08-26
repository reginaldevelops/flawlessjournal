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
  background: #eaeaeaff; /* zwart ipv wit voor meer contrast */
  color: #e5e7eb;
`;

const Content = styled.main`
  width: 100%;
`;
