"use client";

import { useState, useEffect } from "react";
import styled, { ThemeProvider, createGlobalStyle } from "styled-components";
import JournalTable from "./components/JournalTable";
import SidePanelForm from "./components/SidePanelForm";
import SettingsPopup from "./components/SettingsPopup";
import Navbar from "./components/Navbar";

const lightTheme = {
  background: "#ffffff",
  foreground: "#171717",
};

const darkTheme = {
  background: "#171717",
  foreground: "#ffffff",
};

const GlobalStyle = createGlobalStyle`
  body {
    background: ${(p) => p.theme.background};
    color: ${(p) => p.theme.foreground};
    font-family: ${(p) => p.fontFamily};
    font-size: ${(p) => p.fontSize};
    transition: background 0.3s, color 0.3s;
  }
`;

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const [trades, setTrades] = useState([]);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  // ✅ settings states
  const [fontSize, setFontSize] = useState("16px");
  const [fontFamily, setFontFamily] = useState("Arial, sans-serif");
  // inside Home component
  const [columns, setColumns] = useState([
    { id: "date", label: "Date", visible: true },
    { id: "timeEntry", label: "Time Entry", visible: true },
    { id: "coin", label: "Coin", visible: true },
    { id: "chart", label: "Chart", visible: true },
    { id: "usdtChart", label: "USDT Chart", visible: true },
    { id: "timeframe", label: "Timeframe", visible: true },
    { id: "coinPattern", label: "Coin Pattern", visible: true },
    { id: "usdtPattern", label: "USDT Pattern", visible: true },
    { id: "setupQuality", label: "Setup Quality", visible: true },
    { id: "targetRisk", label: "Target Risk", visible: true },
    { id: "confidence", label: "Confidence", visible: true },
    { id: "reasons", label: "Reasons", visible: true },
  ]);

  // load trades
  useEffect(() => {
    const savedTrades = localStorage.getItem("trades");
    if (savedTrades) setTrades(JSON.parse(savedTrades));
  }, []);

  // save trades
  useEffect(() => {
    localStorage.setItem("trades", JSON.stringify(trades));
  }, [trades]);

  // handle Add
  const handleAddTrade = () => {
    const now = new Date();
    const freshTrade = {
      id: Date.now(),
      date: now.toISOString().split("T")[0],
      timeEntry: now.toTimeString().slice(0, 5),
      coin: "",
      chart: "",
      usdtChart: "",
      timeframe: "",
      coinPattern: "",
      usdtPattern: "",
      setupQuality: "",
      targetRisk: "",
      confidence: "",
      reasons: "",
    };
    setSelectedTrade(freshTrade);
    setIsAdding(true);
    setShowPanel(true);
  };

  // handle Edit
  const handleEditTrade = (trade) => {
    setSelectedTrade(trade);
    setIsAdding(false);
    setShowPanel(true);
  };

  // handle Save
  const handleSaveTrade = (trade) => {
    if (isAdding) {
      setTrades([...trades, trade]);
    } else {
      setTrades(trades.map((t) => (t.id === trade.id ? trade : t)));
    }
    setShowPanel(false);
    setSelectedTrade(null);
  };

  const handleCancel = () => {
    setShowPanel(false);
    setSelectedTrade(null);
  };

  // ✅ handle row checkbox
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ✅ delete multiple trades
  const deleteSelected = () => {
    setTrades(trades.filter((t) => !selectedIds.includes(t.id)));
    setSelectedIds([]);
  };

  return (
    <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
      <GlobalStyle fontSize={fontSize} fontFamily={fontFamily} />
      <Container style={{ fontSize, fontFamily }}>
        <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
        <TopBar>
          <AddBtn onClick={handleAddTrade}>+ Add Trade</AddBtn>
          <DeleteBtn
            onClick={deleteSelected}
            disabled={selectedIds.length === 0}
          >
            🗑 Delete
          </DeleteBtn>
          <GearBtn onClick={() => setShowSettings(true)}>⚙️</GearBtn>
        </TopBar>

        {selectedIds.length > 0 && (
          <SelectedInfo>{selectedIds.length} trade(s) selected</SelectedInfo>
        )}

        <JournalTable
          trades={trades}
          onRowClick={handleEditTrade}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          columns={columns}
        />

        {showPanel && (
          <SidePanelForm
            trade={selectedTrade}
            isAdding={isAdding}
            onSave={handleSaveTrade}
            onCancel={handleCancel}
          />
        )}

        {showSettings && (
          <SettingsPopup
            onClose={() => setShowSettings(false)}
            fontSize={fontSize}
            setFontSize={setFontSize}
            fontFamily={fontFamily}
            setFontFamily={setFontFamily}
            columns={columns}
            setColumns={setColumns}
          />
        )}
      </Container>
    </ThemeProvider>
  );
}

/* === Styles === */

const Container = styled.div`
  max-width: 100%;
  margin: 0 auto;
  padding: 1rem;
  background: ${(p) => p.theme.background}; /* use theme */
  color: ${(p) => p.theme.foreground}; /* use theme */
  min-height: 100vh;
  transition:
    background 0.3s,
    color 0.3s;
`;

const TopBar = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const AddBtn = styled.button`
  padding: 0.6rem 1rem;
  background: #2563eb; /* stays brand blue */
  color: #fff;
  font-weight: bold;
  border: none;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: #1d4ed8;
  }
`;

const DeleteBtn = styled.button`
  padding: 0.6rem 1rem;
  background: ${(p) => (p.disabled ? "#666" : "#aaa")};
  color: #fff;
  font-weight: bold;
  border: none;
  border-radius: 6px;
  cursor: ${(p) => (p.disabled ? "not-allowed" : "pointer")};
  opacity: ${(p) => (p.disabled ? 0.5 : 1)};

  &:hover {
    background: ${(p) => (p.disabled ? "#666" : "#e11d48")};
  }
`;

const GearBtn = styled.button`
  padding: 0.6rem;
  background: ${(p) => p.theme.foreground};
  color: ${(p) => p.theme.background};
  font-size: 1.1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-left: auto;

  &:hover {
    opacity: 0.8;
  }
`;

const SelectedInfo = styled.div`
  margin-bottom: 0.5rem;
  color: #2563eb;
  font-size: 0.9rem;
`;
