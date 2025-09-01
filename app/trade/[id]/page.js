"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import styled from "styled-components";
import CreatableSelect from "react-select/creatable";
import LayoutWrapper from "../../components/LayoutWrapper";

export default function TradeViewPage() {
  const { id } = useParams();
  const [trade, setTrade] = useState(null);
  const [variables, setVariables] = useState([]);
  const [menuOpen, setMenuOpen] = useState(null);
  const [showUsdtChart, setShowUsdtChart] = useState(false);

  /* ---------- vaste volgorde ---------- */
  const fixedOrder = [
    "Trade number",
    "Coins",
    "Datum",
    "Entreetijd",
    "Chart",
    "USDT.D chart",
    "Confidence",
    "Target Win",
    "Target loss",
    "Reasons for entry",
    "PNL",
  ];

  /* ---------- Load trade ---------- */
  useEffect(() => {
    const loadTrade = async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) {
        const newState = {
          id: data.id,
          "Trade number": data.trade_number,
          ...data.data,
        };

        // 🟢 Debug logs
        console.log("👉 Raw data from Supabase:", data);
        console.log("👉 State we will set:", newState);

        setTrade(newState);
      } else {
        console.error("❌ Load trade error:", error);
      }
    };

    if (id) loadTrade();
  }, [id]);

  /* ---------- Load all variables (fixed + custom) ---------- */
  useEffect(() => {
    const loadVariables = async () => {
      const { data, error } = await supabase.from("variables").select("*");
      if (!error && data) {
        console.log(
          "👉 Variables loaded:",
          data.map((v) => v.name)
        );
        setVariables(data);
      }
    };
    loadVariables();
  }, []);

  /* ---------- Save trade ---------- */
  const saveTrade = async (updated) => {
    setTrade(updated);
    const { error } = await supabase
      .from("trades")
      .update({ data: updated })
      .eq("id", updated.id);

    if (error) console.error("❌ Save error:", error);
  };

  const deleteTrade = async () => {
    if (!confirm("Weet je zeker dat je deze trade wilt verwijderen?")) return;

    const { error } = await supabase.from("trades").delete().eq("id", trade.id);

    if (error) {
      console.error("❌ Delete error:", error);
      return;
    }

    // Na verwijderen terug naar overzicht
    window.location.href = "/";
  };

  /* ---------- Add new custom variable ---------- */
  const addVariable = async () => {
    const newKey = prompt("Name of new variable?");
    if (!newKey) return;

    const { data, error } = await supabase
      .from("variables")
      .insert([{ name: newKey, type: "custom", options: [], editable: true }])
      .select();

    if (!error && data) {
      setVariables((prev) => [...prev, data[0]]);
    }
  };

  /* ---------- Rename variable ---------- */
  const renameVariable = async (variable, newName) => {
    if (!newName || newName === variable.name) {
      setMenuOpen(null);
      return;
    }

    const { error } = await supabase
      .from("variables")
      .update({ name: newName })
      .eq("id", variable.id);

    if (!error) {
      setVariables((prev) =>
        prev.map((x) => (x.id === variable.id ? { ...x, name: newName } : x))
      );

      if (trade[variable.name] !== undefined) {
        const updated = { ...trade };
        updated[newName] = updated[variable.name];
        delete updated[variable.name];
        saveTrade(updated);
      }
    }
    setMenuOpen(null);
  };

  /* ---------- Delete variable ---------- */
  const deleteVariable = async (variable) => {
    if (!confirm(`Delete variable "${variable.name}"?`)) return;

    const { error } = await supabase
      .from("variables")
      .delete()
      .eq("id", variable.id);

    if (!error) {
      setVariables((prev) => prev.filter((x) => x.id !== variable.id));
      const updated = { ...trade };
      delete updated[variable.name];
      saveTrade(updated);
    }
    setMenuOpen(null);
  };

  if (!trade) return <Wrapper>Loading trade...</Wrapper>;

  return (
    <LayoutWrapper>
      <Wrapper>
        <Header>
          <h2>{trade.Coins || "Unknown Coin"}</h2>
          <HeaderActions>
            <span>{trade.Datum || "—"}</span>
            <DeleteButton onClick={deleteTrade}>🗑️</DeleteButton>
          </HeaderActions>
        </Header>

        <Content>
          <Sidebar>
            <PnLHighlight $positive={Number(trade["PNL"]) >= 0}>
              <span>Net PnL</span>
              {Number(trade["PNL"]) >= 0 ? "+" : ""}${trade["PNL"] || 0}
            </PnLHighlight>
            <DetailSection>
              <h2>Details</h2>
              {variables
                .filter((v) => v.type === "fixed")
                .sort(
                  (a, b) =>
                    fixedOrder.indexOf(a.name) - fixedOrder.indexOf(b.name)
                )
                .map((v) => {
                  // 🔹 Trade Number → read-only
                  if (v.name === "Trade number") {
                    return (
                      <Item key={v.id}>
                        <strong>{v.name}</strong>
                        <div>{trade["Trade number"] || "—"}</div>
                      </Item>
                    );
                  }

                  // 🔹 Skip PNL en Time exit
                  if (v.name === "PNL" || v.name === "Time exit") {
                    return null;
                  }

                  const value = trade[v.name] || "";

                  // 🔹 Coins & Confidence → dropdown
                  if (["Coins", "Confidence"].includes(v.name)) {
                    return (
                      <Item key={v.id}>
                        <strong>{v.name}</strong>
                        <CreatableSelect
                          value={value ? { value, label: value } : null}
                          options={(v.options || []).map((opt) => ({
                            value: opt,
                            label: opt,
                          }))}
                          onChange={(sel) =>
                            saveTrade({
                              ...trade,
                              [v.name]: sel ? sel.value : "",
                            })
                          }
                          onCreateOption={async (inputValue) => {
                            const newOptions = [
                              ...(v.options || []),
                              inputValue,
                            ];
                            await supabase
                              .from("variables")
                              .update({ options: newOptions })
                              .eq("id", v.id);

                            setVariables((prev) =>
                              prev.map((x) =>
                                x.id === v.id
                                  ? { ...x, options: newOptions }
                                  : x
                              )
                            );

                            saveTrade({ ...trade, [v.name]: inputValue });
                          }}
                          placeholder="Select or type..."
                        />
                      </Item>
                    );
                  }

                  // 🔹 Datum → date picker
                  if (v.name === "Datum") {
                    return (
                      <Item key={v.id}>
                        <strong>{v.name}</strong>
                        <input
                          type="date"
                          value={value}
                          onChange={(e) =>
                            saveTrade({ ...trade, [v.name]: e.target.value })
                          }
                        />
                      </Item>
                    );
                  }

                  // 🔹 Entreetijd → time picker
                  if (v.name === "Entreetijd") {
                    return (
                      <Item key={v.id}>
                        <strong>{v.name}</strong>
                        <input
                          type="time"
                          value={value}
                          onChange={(e) =>
                            saveTrade({ ...trade, [v.name]: e.target.value })
                          }
                        />
                      </Item>
                    );
                  }

                  // 🔹 Reasons for entry → textarea
                  if (v.name === "Reasons for entry") {
                    return (
                      <Item key={v.id}>
                        <strong>{v.name}</strong>
                        <textarea
                          rows={3}
                          value={value}
                          onChange={(e) =>
                            saveTrade({ ...trade, [v.name]: e.target.value })
                          }
                        />
                      </Item>
                    );
                  }

                  // 🔹 default → text input
                  return (
                    <Item key={v.id}>
                      <strong>{v.name}</strong>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) =>
                          saveTrade({ ...trade, [v.name]: e.target.value })
                        }
                      />
                    </Item>
                  );
                })}
            </DetailSection>

            <Divider />

            {/* ✅ Custom variables */}
            <DetailSection>
              {variables
                .filter((v) => v.type === "custom")
                .map((v) => {
                  const value = trade[v.name] || "";

                  return (
                    <Item key={v.id}>
                      <VariableHeader>
                        <strong>{v.name}</strong>
                        {v.editable && (
                          <MenuWrapper>
                            <MenuButton
                              onClick={() =>
                                setMenuOpen(menuOpen === v.id ? null : v.id)
                              }
                            >
                              ⋮
                            </MenuButton>
                            {menuOpen === v.id && (
                              <Dropdown>
                                <button
                                  onClick={() => {
                                    const newName = prompt("New name?", v.name);
                                    if (newName)
                                      renameVariable(v, newName.trim());
                                  }}
                                >
                                  ✏ Rename
                                </button>
                                <button
                                  onClick={() => deleteVariable(v)}
                                  style={{ color: "red" }}
                                >
                                  🗑 Delete
                                </button>
                              </Dropdown>
                            )}
                          </MenuWrapper>
                        )}
                      </VariableHeader>

                      <CreatableSelect
                        value={value ? { value, label: value } : null}
                        options={v.options.map((opt) => ({
                          value: opt,
                          label: opt,
                        }))}
                        onChange={(sel) =>
                          saveTrade({
                            ...trade,
                            [v.name]: sel ? sel.value : "",
                          })
                        }
                        onCreateOption={async (inputValue) => {
                          const newOptions = [...v.options, inputValue];

                          await supabase
                            .from("variables")
                            .update({ options: newOptions })
                            .eq("id", v.id);

                          setVariables((prev) =>
                            prev.map((x) =>
                              x.id === v.id ? { ...x, options: newOptions } : x
                            )
                          );

                          saveTrade({ ...trade, [v.name]: inputValue });
                        }}
                        placeholder="Select or type..."
                      />
                    </Item>
                  );
                })}
            </DetailSection>

            <AddNewVariable onClick={addVariable}>
              + Add new category
            </AddNewVariable>

            <Divider />

            {/* 2️⃣ Exit & PnL sectie */}
            <DetailSection>
              <h2>Exit & Result</h2>

              {/* Exit time */}
              <Item>
                <strong>Exit time</strong>
                <input
                  type="time"
                  value={trade["Time exit"] || ""}
                  onChange={(e) =>
                    saveTrade({ ...trade, ["Time exit"]: e.target.value })
                  }
                />
              </Item>

              {/* PNL */}
              <Item>
                <strong>PNL</strong>
                <input
                  type="number"
                  step="0.01"
                  value={trade["PNL"] || ""}
                  onChange={(e) =>
                    saveTrade({ ...trade, PNL: Number(e.target.value) })
                  }
                />
              </Item>
            </DetailSection>
          </Sidebar>

          <Main>
            <ChartCard>
              <h3>Coin Chart</h3>
              {trade.Chart ? (
                <a href={trade.Chart} target="_blank" rel="noopener noreferrer">
                  <img src={trade.Chart} alt="Coin Chart" />
                </a>
              ) : (
                <Empty>Geen chart toegevoegd</Empty>
              )}
            </ChartCard>

            <ChartCard>
              <h3>
                USDT.D Chart
                <ToggleButton onClick={() => setShowUsdtChart(!showUsdtChart)}>
                  {showUsdtChart ? "Hide" : "Show"}
                </ToggleButton>
              </h3>

              {showUsdtChart &&
                (trade["USDT.D chart"] ? (
                  <a
                    href={trade["USDT.D chart"]}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img src={trade["USDT.D chart"]} alt="USDT.D Chart" />
                  </a>
                ) : (
                  <Empty>Geen USDT.D chart toegevoegd</Empty>
                ))}
            </ChartCard>

            <NotesCard>
              <h3>Trade evaluation</h3>
              <textarea
                value={trade["Notes"] || ""}
                onChange={(e) => saveTrade({ ...trade, Notes: e.target.value })}
              />
            </NotesCard>
          </Main>
        </Content>
      </Wrapper>
    </LayoutWrapper>
  );
}

/* ---------------- styled ---------------- */
const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  background: #f9fafb;
`;
const Header = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
`;
const Content = styled.div`
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1.5rem;
  padding: 1.5rem 2rem;
`;
const Sidebar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;
const PnLHighlight = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  background: ${(p) => (p.$positive ? "#ecfdf5" : "#fef2f2")};
  color: ${(p) => (p.$positive ? "#059669" : "#dc2626")};
  border: 1px solid ${(p) => (p.$positive ? "#a7f3d0" : "#fecaca")};
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);

  span {
    font-size: 0.9rem;
    font-weight: 500;
    color: #6b7280;
  }
`;
const DetailSection = styled.div`
  background: #fff;
  border-radius: 12px;
  padding: 1.2rem 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;

  h2 {
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 0.4rem;
    color: #374151;
  }
`;
const Item = styled.div`
  display: flex;
  flex-direction: column; /* 👈 belangrijk */
  gap: 0.3rem;

  strong {
    font-size: 0.85rem;
    font-weight: 500;
    color: #6b7280;
  }

  input,
  select {
    padding: 0.55rem 0.8rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 0.9rem;
    font-family: inherit;
    background: #fafafa;
    transition:
      border 0.2s,
      box-shadow 0.2s,
      background 0.2s;
  }

  textarea {
    width: 100%;
    min-height: 160px;
    resize: vertical;
    padding: 0.7rem 0.9rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 0.9rem;
    font-family: inherit;
    background: #fafafa;
    transition:
      border 0.2s,
      box-shadow 0.2s,
      background 0.2s;
  }

  input:focus,
  textarea:focus,
  select:focus {
    border-color: #6366f1;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    outline: none;
  }
`;

const VariableHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
const MenuWrapper = styled.div`
  position: relative;
`;
const MenuButton = styled.button`
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
`;
const Dropdown = styled.div`
  position: absolute;
  top: 1.5rem;
  right: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 10;

  button {
    background: none;
    border: none;
    padding: 0.4rem 0.8rem;
    font-size: 0.85rem;
    cursor: pointer;
    text-align: left;

    &:hover {
      background: #f3f4f6;
    }
  }
`;
const Divider = styled.div`
  border-bottom: 1px solid #e5e7eb;
  margin: 0.8rem 0;
`;
const Main = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;
const ChartCard = styled.div`
  background: #fff;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);

  img {
    max-width: 100%; /* nooit breder dan container */
    max-height: 800px; /* pas max hoogte aan naar smaak */
    object-fit: contain;
    border-radius: 8px;
    display: block;
    margin: 0 auto;
  }
`;

const ToggleButton = styled.button`
  margin-left: 1rem;
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
  cursor: pointer;
  &:hover {
    background: #f3f4f6;
  }
`;

const Empty = styled.div`
  font-size: 0.85rem;
  color: #aaa;
  text-align: center;
  padding: 2rem 0;
`;
const NotesCard = styled.div`
  background: #fff;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  textarea {
    width: 100%;
    min-height: 150px;
    font-size: 0.9rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.6rem;
  }
`;
const AddNewVariable = styled.div`
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #0ea5e9;
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  color: #dc2626;

  &:hover {
    color: #b91c1c;
  }
`;
