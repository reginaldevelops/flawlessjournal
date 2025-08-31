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
    color: #000000ff;
    font-weight: 400; /* default gewicht, font komt via next/font */
  }

  /* Zorg dat form controls hetzelfde font pakken als body */
  input, textarea, select, button {
    font-family: inherit;
  }

  /* Headings gebruiken echte bold varianten */
  h1, h2, h3, h4, h5, h6 {
    font-weight: 600; /* of 700 als je ze vetter wilt */
    margin: 0;
  }

  /* Scrollbars - Chrome, Edge, Safari */
  ::-webkit-scrollbar {
    height: 10px;
    width: 10px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.82);
    border-radius: 10px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #cfc8cdff, #5555ff);
  }

  /* Scrollbars - Firefox */
  * {
    scrollbar-width: thin;
    scrollbar-color: #d8d0d7ff #787883ff;
  }
`;
