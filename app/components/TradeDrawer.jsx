import styled from "styled-components";
import { useState, useEffect } from "react";

export default function TradeDrawer({ open, trade, onClose, onSave }) {
  const [form, setForm] = useState(trade || {});

  useEffect(() => {
    setForm(trade || {});
  }, [trade]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  return (
    <Drawer>
      <Header>
        <h2>{trade?.id ? "Edit Trade" : "Add Trade"}</h2>
        <button onClick={onClose}>X</button>
      </Header>

      <Form>
        <label>Date</label>
        <input type="date" value={form.date || ""} onChange={(e) => handleChange("date", e.target.value)} />

        <label>Time</label>
        <input type="time" value={form.timeEntry || ""} onChange={(e) => handleChange("timeEntry", e.target.value)} />

        <label>Coin</label>
        <input value={form.coin || ""} onChange={(e) => handleChange("coin", e.target.value)} />

        <label>Setup</label>
        <input value={form.setup || ""} onChange={(e) => handleChange("setup", e.target.value)} />

        <label>Direction</label>
        <select value={form.direction || "Long"} onChange={(e) => handleChange("direction", e.target.value)}>
          <option>Long</option>
          <option>Short</option>
        </select>

        <label>Entry Price</label>
        <input type="number" value={form.entryPrice || ""} onChange={(e) => handleChange("entryPrice", e.target.value)} />

        <label>Exit Price</label>
        <input type="number" value={form.exitPrice || ""} onChange={(e) => handleChange("exitPrice", e.target.value)} />

        <label>Stop Loss</label>
        <input type="number" value={form.stopLoss || ""} onChange={(e) => handleChange("stopLoss", e.target.value)} />

        <label>Take Profit</label>
        <input type="number" value={form.takeProfit || ""} onChange={(e) => handleChange("takeProfit", e.target.value)} />

        <label>Confidence</label>
        <select value={form.confidence || ""} onChange={(e) => handleChange("confidence", e.target.value)}>
          {[...Array(10).keys()].map((n) => (
            <option key={n+1}>{n+1}</option>
          ))}
        </select>

        <label>Notes</label>
        <textarea value={form.notes || ""} onChange={(e) => handleChange("notes", e.target.value)} />

        <SaveBtn onClick={() => onSave(form)}>Save</SaveBtn>
      </Form>
    </Drawer>
  );
}

const Drawer = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100%;
  background: #2a2a3a;
  color: white;
  box-shadow: -2px 0 10px rgba(0,0,0,0.5);
  padding: 1rem;
  z-index: 1000;
  overflow-y: auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;

  h2 {
    margin: 0;
  }

  button {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: white;
  }
`;

const Form = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 1rem;

  label {
    margin-top: 0.8rem;
  }

  input, select, textarea {
    margin-top: 0.2rem;
    padding: 0.4rem;
    border: none;
    border-radius: 4px;
  }
`;

const SaveBtn = styled.button`
  margin-top: 1.5rem;
  padding: 0.6rem;
  background: #4cafef;
  border: none;
  border-radius: 6px;
  color: white;
  font-weight: bold;
  cursor: pointer;
`;
