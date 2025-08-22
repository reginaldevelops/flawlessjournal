"use client";
import { createGlobalStyle } from "styled-components";

export const GlobalStyles = createGlobalStyle`
  /* Basis reset */
  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    background: radial-gradient(circle at top left, #0f0c29, #302b63, #24243e);
    color: #fff;
    font-family: "Orbitron", sans-serif;
  }

  /* Scrollbars - Chrome, Edge, Safari */
  ::-webkit-scrollbar {
    height: 10px;
    width: 10px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }

  ::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #c2b5bfff, #3333ff);
    border-radius: 10px;
    border: 2px solid rgba(0, 0, 0, 0.4);
  }

  ::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #c8bbc5ff, #5555ff);
  }

  /* Scrollbars - Firefox */
  * {
    scrollbar-width: thin;
    scrollbar-color: #d4bfd0ff #1a1a2e;
  }
`;
