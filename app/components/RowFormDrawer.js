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

/* styled */
const AddButton = styled.button`
  background: #22c55e;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1.2rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  &:hover {
    background: #16a34a;
  }
`;

const Drawer = styled.div`
  position: fixed;
  top: 0;
  right: ${({ $open }) => ($open ? "0" : "-400px")};
  height: 100vh;
  width: 400px;
  background: white;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
  transition: right 0.3s ease;
  z-index: 50;
  display: flex;
  flex-direction: column;
`;

const DrawerContent = styled.div`
  padding: 2rem;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const CloseButton = styled.button`
  align-self: flex-end;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #555;
  margin-bottom: 1rem;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
`;

const Input = styled.input`
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 8px;
`;

const SubmitButton = styled.button`
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: auto;
  &:hover {
    background: #2563eb;
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 40;
`;

const Select = styled.select`
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 8px;
`;
