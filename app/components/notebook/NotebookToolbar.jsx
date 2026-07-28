"use client";

import { useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { cn } from "../ui";

function ToolButton({ label, icon: Icon, active, disabled, onClick }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-content-muted transition-colors",
        "hover:bg-surface-hover hover:text-content disabled:pointer-events-none disabled:opacity-35",
        active && "bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand"
      )}
    >
      <Icon size={14} strokeWidth={1.9} aria-hidden />
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-line" aria-hidden />;
}

export default function NotebookToolbar({ editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold"),
      italic: current?.isActive("italic"),
      underline: current?.isActive("underline"),
      strike: current?.isActive("strike"),
      heading1: current?.isActive("heading", { level: 1 }),
      heading2: current?.isActive("heading", { level: 2 }),
      bulletList: current?.isActive("bulletList"),
      orderedList: current?.isActive("orderedList"),
      taskList: current?.isActive("taskList"),
      blockquote: current?.isActive("blockquote"),
      codeBlock: current?.isActive("codeBlock"),
      highlight: current?.isActive("highlight"),
      link: current?.isActive("link"),
      alignLeft: current?.isActive({ textAlign: "left" }),
      alignCenter: current?.isActive({ textAlign: "center" }),
      alignRight: current?.isActive({ textAlign: "right" }),
      canUndo: current?.can().chain().focus().undo().run(),
      canRedo: current?.can().chain().focus().redo().run(),
    }),
  });

  if (!editor) return <div className="h-11 border-b border-line bg-surface-sunken/60" />;

  const setLink = () => {
    const previous = editor.getAttributes("link").href;
    const url = window.prompt("Paste a link", previous || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div className="flex h-11 shrink-0 items-center overflow-x-auto border-b border-line bg-surface-sunken/60 px-3 no-scrollbar">
      <ToolButton
        label="Undo"
        icon={Undo2}
        disabled={!state?.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolButton
        label="Redo"
        icon={Redo2}
        disabled={!state?.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      />
      <Divider />
      <ToolButton
        label="Bold"
        icon={Bold}
        active={state?.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolButton
        label="Italic"
        icon={Italic}
        active={state?.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        label="Underline"
        icon={Underline}
        active={state?.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolButton
        label="Strikethrough"
        icon={Strikethrough}
        active={state?.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolButton
        label="Highlight"
        icon={Highlighter}
        active={state?.highlight}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      />
      <Divider />
      <ToolButton
        label="Heading 1"
        icon={Heading1}
        active={state?.heading1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolButton
        label="Heading 2"
        icon={Heading2}
        active={state?.heading2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <Divider />
      <ToolButton
        label="Bullet list"
        icon={List}
        active={state?.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolButton
        label="Numbered list"
        icon={ListOrdered}
        active={state?.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolButton
        label="Task list"
        icon={ListTodo}
        active={state?.taskList}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      />
      <ToolButton
        label="Blockquote"
        icon={Quote}
        active={state?.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolButton
        label="Code block"
        icon={Code2}
        active={state?.codeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolButton
        label="Horizontal rule"
        icon={Minus}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
      <Divider />
      <ToolButton
        label="Align left"
        icon={AlignLeft}
        active={state?.alignLeft}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      />
      <ToolButton
        label="Align center"
        icon={AlignCenter}
        active={state?.alignCenter}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      />
      <ToolButton
        label="Align right"
        icon={AlignRight}
        active={state?.alignRight}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      />
      <Divider />
      <ToolButton label="Add link" icon={Link2} active={state?.link} onClick={setLink} />
      <ToolButton
        label="Remove link"
        icon={Unlink}
        disabled={!state?.link}
        onClick={() => editor.chain().focus().unsetLink().run()}
      />
    </div>
  );
}
