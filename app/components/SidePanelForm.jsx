"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";

export default function SidePanelForm({ trade, isAdding, onSave, onCancel }) {
  const [formData, setFormData] = useState(trade);

  // sync when trade changes
  useEffect(() => {
    setFormData(trade);
  }, [trade]);

  const updateField = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <Panel>
      <Header>
        <h2>{isAdding ? "Add Trade" : "Edit Trade"}</h2>
        <button onClick={onCancel}>❌</button>
      </Header>

      <Form>
        <label>Date</label>
        <input
          type="date"
          value={formData.date}
          onChange={(e) => updateField("date", e.target.value)}
        />

        <label>Time Entry</label>
        <input
          type="time"
          value={formData.timeEntry}
          onChange={(e) => updateField("timeEntry", e.target.value)}
        />

        <label>Coin</label>
        <input
          type="text"
          value={formData.coin}
          onChange={(e) => updateField("coin", e.target.value)}
        />

        <label>Chart URL</label>
        <input
          type="text"
          value={formData.chart}
          onChange={(e) => updateField("chart", e.target.value)}
        />

        <label>USDT.D Chart</label>
        <input
          type="text"
          value={formData.usdtChart}
          onChange={(e) => updateField("usdtChart", e.target.value)}
        />

        <label>Timeframe</label>
        <select
          value={formData.timeframe}
          onChange={(e) => updateField("timeframe", e.target.value)}
        >
          <option value="">Select</option>
          <option>15m</option>
          <option>1h</option>
          <option>4h</option>
          <option>1d</option>
          <option>1w</option>
        </select>

        <label>Coin Pattern</label>
        <input
          type="text"
          value={formData.coinPattern}
          onChange={(e) => updateField("coinPattern", e.target.value)}
        />

        <label>USDT.D Pattern</label>
        <input
          type="text"
          value={formData.usdtPattern}
          onChange={(e) => updateField("usdtPattern", e.target.value)}
        />

        <label>Setup Quality</label>
        <select
          value={formData.setupQuality}
          onChange={(e) => updateField("setupQuality", e.target.value)}
        >
          <option value="">Select</option>
          <option>A+</option>
          <option>A-</option>
          <option>B+</option>
          <option>B-</option>
        </select>

        <label>Confidence (1-10)</label>
        <select
          value={formData.confidence}
          onChange={(e) => updateField("confidence", e.target.value)}
        >
          <option value="">Select</option>
          {[...Array(10).keys()].map((n) => (
            <option key={n + 1}>{n + 1}</option>
          ))}
        </select>

        <label>Reasons</label>
        <textarea
          value={formData.reasons}
          onChange={(e) => updateField("reasons", e.target.value)}
        />

        <SaveBtn onClick={handleSubmit}>
          {isAdding ? "Add Trade" : "Save Changes"}
        </SaveBtn>
      </Form>
    </Panel>
  );
}

/* === Styles === */

const Panel = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  width: 350px;
  height: 100%;
  background: #222;
  color: white;
  padding: 1rem;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  z-index: 1000;
  animation: slideIn 0.3s ease forwards;

  @keyframes slideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0%);
    }
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;

  button {
    background: transparent;
    border: none;
    color: white;
    font-size: 1.2rem;
    cursor: pointer;
  }
`;

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-size: 0.85rem;
    margin-top: 0.5rem;
  }

  input,
  select,
  textarea {
    padding: 0.4rem;
    border-radius: 6px;
    border: none;
    font-size: 0.9rem;
  }

  textarea {
    min-height: 60px;
    resize: vertical;
  }
`;

const SaveBtn = styled.button`
  margin-top: 1rem;
  padding: 0.6rem 1rem;
  background: #ff6b6b;
  color: white;
  font-weight: bold;
  border: none;
  border-radius: 6px;
  cursor: pointer;
`;
