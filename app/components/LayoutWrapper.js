// app/components/LayoutWrapper.js
import styled from "styled-components";
import Image from "next/image";
import FlawlessLogo from "./FlawlessLogo";

export default function LayoutWrapper({ children }) {
  return (
    <Container>
      {/* <Header>
        <Background>
          <Image
            src={"/flawless-bg.png"}
            alt="Cyberpunk background"
            fill
            priority
          />
        </Background>

        <LogoWrapper>
          <Image
            src={"/flawless-title2.png"}
            alt="Cyberpunk background"
            fill
            priority
          />
        </LogoWrapper>
      </Header> */}

      <Content>{children}</Content>
    </Container>
  );
}

/* ---------------- styled ---------------- */
const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #ffffffff;
`;

const Header = styled.div`
  position: relative;
  width: 100%;
  height: 5vh;
  overflow: hidden;
`;

const Background = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 1;

  img {
    object-fit: cover;
    object-position: bottom; /* uitlijnen onderaan */
  }
`;

const LogoWrapper = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  margin: auto;
  min-width: 400px;
  max-width: 800px;

  filter: drop-shadow(0 0 10px rgba(255, 0, 200, 0.7))
    drop-shadow(0 0 18px rgba(0, 200, 255, 0.6));

  img {
    object-fit: scale-down;
  }
`;

const Content = styled.div`
  width: 100%;
`;
