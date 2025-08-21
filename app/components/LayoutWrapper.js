// app/components/LayoutWrapper.js
import styled from "styled-components";

export default function LayoutWrapper({ children }) {
  return (
    <Container>
      <Header>📊 Mijn Dynamische Tabel</Header>
      <SubHeader>Voeg kolommen en rijen toe en bewerk ze inline</SubHeader>
      {children}
    </Container>
  );
}

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  background: #f9fafb;
`;

const Header = styled.h1`
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
`;

const SubHeader = styled.p`
  font-size: 1rem;
  color: #555;
  margin-bottom: 2rem;
`;
