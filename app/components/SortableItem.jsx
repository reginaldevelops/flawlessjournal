"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import styled from "styled-components";

export default function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Wrapper ref={setNodeRef} style={style}>
      <DragHandle {...attributes} {...listeners}>
        ☰
      </DragHandle>
      <Content>{children}</Content>
    </Wrapper>
  );
}

/* === Styles === */
const Wrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0.4rem 0.6rem;
  margin-bottom: 0.4rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: inherit;
`;

const DragHandle = styled.div`
  cursor: grab;
  margin-right: 0.5rem;
  user-select: none;
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;
