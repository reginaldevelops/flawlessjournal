"use client";

import { useState } from "react";
import styled from "styled-components";

export default function RowFormDrawer({ columns, onAddRow }) {
  const [open, setOpen] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const newRow = {};
    columns.forEach((col) => {
      if (col.type === "boolean") {
        newRow[col.name] = formData.get(col.name) === "on"; // ✅ true/false
      } else {
        newRow[col.name] = formData.get(col.name) || "";
      }
    });
    onAddRow(newRow);
    setOpen(false);
    e.target.reset();
  };

  return (
    <>
      <AddButton onClick={() => setOpen(true)}>+ Trade toevoegen</AddButton>

      <Drawer $open={open}>
        <DrawerContent>
          <CloseButton onClick={() => setOpen(false)}>✕</CloseButton>
          <h2>Nieuwe rij toevoegen</h2>
          <Form onSubmit={handleSubmit}>
            {columns.map((col) => {
              if (col.type === "boolean") {
                return (
                  <label key={col.name}>
                    <input
                      type="checkbox"
                      name={col.name}
                      defaultChecked={false}
                    />
                    {col.name}
                  </label>
                );
              } else if (col.type === "select") {
                return (
                  <label key={col.name}>
                    {col.name}
                    <Select name={col.name}>
                      {col.options?.map((opt, i) => (
                        <option key={i} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Select>
                  </label>
                );
              } else {
                return (
                  <Input
                    key={col.name}
                    name={col.name}
                    placeholder={col.name}
                    type={col.type}
                  />
                );
              }
            })}

            <SubmitButton type="submit">Opslaan</SubmitButton>
          </Form>
        </DrawerContent>
      </Drawer>

      {open && <Overlay onClick={() => setOpen(false)} />}
    </>
  );
}

/* ---------------- styled ---------------- */
const AddButton = styled.button`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 0.6rem 1.2rem;
  cursor: pointer;
  color: #111;
  font-weight: 500;
  font-size: 0.9rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.2s;

  &:hover {
    border-color: rgba(14, 165, 233, 0.6); /* cyan accent */
    color: #0ea5e9;
    box-shadow: 0 2px 6px rgba(14, 165, 233, 0.25);
  }
`;

const Drawer = styled.div`
  position: fixed;
  top: 0;
  left: ${({ $open }) => ($open ? "0" : "-400px")};
  height: 100vh;
  width: 400px;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.1);
  transition: left 0.3s ease;
  z-index: 50;
  display: flex;
  flex-direction: column;
  color: #111;
`;

const DrawerContent = styled.div`
  padding: 2rem;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const Title = styled.h2`
  font-size: 1.1rem;
  margin-bottom: 1.5rem;
  font-weight: 600;
  color: #111;
  border-left: 3px solid rgba(255, 0, 128, 0.6); /* neon pink accent bar */
  padding-left: 0.5rem;
`;

const CloseButton = styled.button`
  align-self: flex-end;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
  margin-bottom: 1rem;
  transition: color 0.2s;

  &:hover {
    color: #db2777; /* neon pink */
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
`;

const Label = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #444;
  font-size: 0.9rem;
`;

const Input = styled.input`
  padding: 0.6rem;
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #111;
  font-size: 0.9rem;
  transition: all 0.2s;

  &::placeholder {
    color: #999;
  }

  &:focus {
    border-color: rgba(14, 165, 233, 0.6); /* cyan accent */
    outline: none;
    box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.15);
  }
`;

const Select = styled.select`
  padding: 0.6rem;
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #111;
  font-size: 0.9rem;
  transition: all 0.2s;

  &:focus {
    border-color: rgba(255, 0, 128, 0.6);
    outline: none;
    box-shadow: 0 0 0 2px rgba(255, 0, 128, 0.15);
  }
`;

const Checkbox = styled.input`
  accent-color: #ff0080; /* neon pink accent */
`;

const SubmitButton = styled.button`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: auto;
  color: #111;
  font-size: 0.9rem;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

  &:hover {
    border-color: rgba(255, 0, 128, 0.6); /* neon pink */
    color: #db2777;
    box-shadow: 0 2px 6px rgba(255, 0, 128, 0.25);
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 40;
`;
