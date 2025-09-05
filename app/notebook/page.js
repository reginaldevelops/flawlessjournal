"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import styled, { keyframes } from "styled-components";

// Lucide icons
import {
  Newspaper,
  Tag,
  Calendar,
  CalendarDays,
  FileText,
  MoreVertical,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List as ListIcon,
  ListOrdered,
  Quote,
  Code,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Loader2,
  Check,
} from "lucide-react";

export default function Notebook() {
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [status, setStatus] = useState("💾 Auto-saved");
  const [openTagMenu, setOpenTagMenu] = useState(null);
  const menuRef = useRef(null);

  // ✅ helper: altijd veilige NL-tijd
  function formatLocal(dateString) {
    if (!dateString) return "—";

    // forceer UTC als er geen Z in zit
    let fixed = dateString.endsWith("Z") ? dateString : dateString + "Z";
    const d = new Date(fixed);

    if (isNaN(d.getTime())) return "—";

    return d.toLocaleString("nl-NL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenTagMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Load tags
  useEffect(() => {
    const loadTags = async () => {
      const { data, error } = await supabase
        .from("notebook_tags")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data) {
        setTags(data);
        if (!selectedTag && data.length > 0) {
          setSelectedTag(data[0]);
        }
      }
    };
    loadTags();
  }, []);

  // Load posts when tag changes
  useEffect(() => {
    const loadPosts = async () => {
      if (!selectedTag) return;
      const { data, error } = await supabase
        .from("notebook")
        .select("*")
        .eq("tag_id", selectedTag.id)
        .order("updated_at", { ascending: false });
      if (!error) setPosts(data || []);
    };
    if (selectedTag) loadPosts();
  }, [selectedTag]);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    immediatelyRender: false,
  });

  const saveTimeout = useRef(null);

  // Auto-save content
  useEffect(() => {
    if (!editor || !selectedPost) return;

    const handleSave = async () => {
      setStatus("⌛ Saving…");
      const content = editor.getHTML();

      if (!selectedPost.id) {
        const { data, error } = await supabase
          .from("notebook")
          .insert([
            {
              title: selectedPost.title || "Untitled",
              content,
              tag_id: selectedTag.id,
            },
          ])
          .select()
          .single();

        if (!error && data) {
          setSelectedPost(data);
          setPosts([data, ...posts]);
        }
      } else {
        await supabase
          .from("notebook")
          .update({
            title: selectedPost.title,
            content,
            updated_at: new Date().toISOString(), // ✅ UTC opslaan
          })
          .eq("id", selectedPost.id);
      }

      setStatus("✅ Saved");
      setTimeout(() => setStatus("💾 Auto-saved"), 1500);
    };

    editor.on("update", () => {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(handleSave, 1500);
    });

    return () => clearTimeout(saveTimeout.current);
  }, [editor, selectedPost, selectedTag, posts]);

  // Auto-save title
  useEffect(() => {
    if (!selectedPost?.id || !selectedPost.title) return;

    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setStatus("⌛ Saving…");
      await supabase
        .from("notebook")
        .update({
          title: selectedPost.title,
          updated_at: new Date().toISOString(), // ✅ UTC opslaan
        })
        .eq("id", selectedPost.id);
      setStatus("✅ Saved");
      setTimeout(() => setStatus("💾 Auto-saved"), 1500);
    }, 1200);

    return () => clearTimeout(saveTimeout.current);
  }, [selectedPost?.title, selectedPost?.id]);

  const handleNewNote = () => {
    setSelectedPost({ title: "Untitled", content: "", tag_id: selectedTag.id });
    editor?.commands.setContent("<p></p>");
  };

  const handleDeleteNote = async () => {
    if (!selectedPost?.id) return;
    await supabase.from("notebook").delete().eq("id", selectedPost.id);
    setPosts(posts.filter((p) => p.id !== selectedPost.id));
    setSelectedPost(null);
  };

  const handleAddTag = async () => {
    const newTag = prompt("New tag:");
    if (!newTag) return;

    const { data, error } = await supabase
      .from("notebook_tags")
      .insert([{ name: newTag, fixed: false }])
      .select()
      .single();

    if (!error && data) {
      setTags([...tags, data]);
    }
  };

  return (
    <Wrapper>
      <TitleHeader>
        <h1>Notebook</h1>
      </TitleHeader>
      <NoteBookWrapper>
        {/* Column 1: Tags */}
        <Column>
          <Header>
            <SmallButton onClick={handleAddTag}>
              <Tag size={18} /> Add tag
            </SmallButton>
          </Header>
          <ListWrapper>
            {tags.map((tag) => {
              const TagIcon =
                tag.name === "Monthly reviews"
                  ? Calendar
                  : tag.name === "Weekly reviews"
                    ? CalendarDays
                    : Tag;

              return (
                <TagRow
                  key={tag.id}
                  $active={selectedTag?.id === tag.id}
                  onClick={() => setSelectedTag(tag)}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <TagIcon size={16} /> {tag.name}
                  </div>
                  {!tag.fixed && (
                    <MenuWrapper ref={menuRef}>
                      <MoreVertical
                        size={16}
                        style={{ cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenTagMenu(
                            openTagMenu === tag.id ? null : tag.id
                          );
                        }}
                      />
                      {openTagMenu === tag.id && (
                        <Menu>
                          <MenuItem
                            onClick={() => {
                              const newName = prompt("Rename tag:", tag.name);
                              if (newName) {
                                supabase
                                  .from("notebook_tags")
                                  .update({ name: newName })
                                  .eq("id", tag.id)
                                  .then(({ error }) => {
                                    if (!error) {
                                      setTags(
                                        tags.map((t) =>
                                          t.id === tag.id
                                            ? { ...t, name: newName }
                                            : t
                                        )
                                      );
                                    }
                                  });
                              }
                              setOpenTagMenu(null);
                            }}
                          >
                            ✏️ Rename
                          </MenuItem>
                          <MenuItem
                            onClick={() => {
                              supabase
                                .from("notebook_tags")
                                .delete()
                                .eq("id", tag.id)
                                .then(() => {
                                  setTags(tags.filter((t) => t.id !== tag.id));
                                  if (selectedTag?.id === tag.id)
                                    setSelectedTag(null);
                                });
                              setOpenTagMenu(null);
                            }}
                          >
                            🗑️ Delete
                          </MenuItem>
                        </Menu>
                      )}
                    </MenuWrapper>
                  )}
                </TagRow>
              );
            })}
          </ListWrapper>
        </Column>

        {/* Column 2: Notes */}
        <Column>
          <Header>
            <SmallButton onClick={handleNewNote}>
              <Newspaper size={18} /> New note
            </SmallButton>
          </Header>
          <ListWrapper>
            {posts.map((post) => (
              <ListItem
                key={post.id}
                $active={selectedPost?.id === post.id}
                onClick={() => {
                  setSelectedPost(post);
                  editor?.commands.setContent(post.content);
                }}
              >
                <FileText size={16} />
                <div>
                  <strong>{post.title}</strong>
                  <small>
                    {formatLocal(post.updated_at || post.created_at)}
                  </small>
                </div>
              </ListItem>
            ))}
          </ListWrapper>
        </Column>

        {/* Column 3: Editor */}
        <EditorColumn>
          {selectedPost ? (
            <>
              {/* Metadata bar */}
              <MetaBar>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <FileText size={20} />
                  <TitleInput
                    value={selectedPost.title}
                    onChange={(e) =>
                      setSelectedPost({
                        ...selectedPost,
                        title: e.target.value,
                      })
                    }
                    placeholder="Untitled note..."
                  />
                </div>

                <TagSelect
                  value={selectedPost.tag_id || ""}
                  onChange={(e) =>
                    setSelectedPost({
                      ...selectedPost,
                      tag_id: e.target.value,
                    })
                  }
                >
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </TagSelect>

                <SaveStatus>
                  {status.includes("Saving") ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} color="green" />
                  )}
                </SaveStatus>

                {/* 🗑️ Delete knop */}
                <SmallButton
                  onClick={() => {
                    if (confirm("Delete this note?")) {
                      handleDeleteNote();
                    }
                  }}
                >
                  🗑️ Delete
                </SmallButton>
              </MetaBar>

              {/* Toolbar */}
              <ToolbarWrapper>
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  $active={editor.isActive("bold")}
                >
                  <Bold size={16} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  $active={editor.isActive("italic")}
                >
                  <Italic size={16} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  $active={editor.isActive("underline")}
                >
                  <UnderlineIcon size={16} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 1 }).run()
                  }
                  $active={editor.isActive("heading", { level: 1 })}
                >
                  <Heading1 size={16} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                  }
                  $active={editor.isActive("heading", { level: 2 })}
                >
                  <Heading2 size={16} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() =>
                    editor.chain().focus().toggleBulletList().run()
                  }
                  $active={editor.isActive("bulletList")}
                >
                  <ListIcon size={16} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() =>
                    editor.chain().focus().toggleOrderedList().run()
                  }
                  $active={editor.isActive("orderedList")}
                >
                  <ListOrdered size={16} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() =>
                    editor.chain().focus().toggleBlockquote().run()
                  }
                  $active={editor.isActive("blockquote")}
                >
                  <Quote size={16} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                  $active={editor.isActive("codeBlock")}
                >
                  <Code size={16} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor.chain().focus().undo().run()}
                >
                  <Undo size={16} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor.chain().focus().redo().run()}
                >
                  <Redo size={16} />
                </ToolbarButton>
              </ToolbarWrapper>

              <EditorBox>
                <EditorContent editor={editor} />
              </EditorBox>
            </>
          ) : (
            <Placeholder>Select or create a note</Placeholder>
          )}
        </EditorColumn>
      </NoteBookWrapper>
    </Wrapper>
  );
}

/* ============================= */
/* ===== styled components ===== */
/* ============================= */

const Wrapper = styled.div`
  max-width: 1256px;
  margin: auto;
  min-height: 90vh;
`;

const TitleHeader = styled.div`
  padding: 2em 0em;
  text-align: center;
`;

const NoteBookWrapper = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 3fr;
  height: 80vh;
  margin: auto;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  margin: 0.3rem;
  background: #fafafa;
`;

const EditorColumn = styled(Column)`
  border-right: none;
  overflow-y: auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-weight: 600;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
`;

const ListWrapper = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const ListItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  cursor: pointer;
  background: ${(p) => (p.$active ? "#e0f2fe" : "transparent")};
  border-left: ${(p) =>
    p.$active ? "4px solid #3b82f6" : "4px solid transparent"};

  &:hover {
    background: #f3f4f6;
  }

  strong {
    display: block;
    font-weight: 500;
    color: #111827;
  }

  small {
    font-size: 12px;
    color: #6b7280;
  }
`;

const TagRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  cursor: pointer;
  background: ${(p) => (p.$active ? "#e0f2fe" : "transparent")};
  border-left: ${(p) =>
    p.$active ? "4px solid #3b82f6" : "4px solid transparent"};

  &:hover {
    background: #f3f4f6;
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
`;

const MenuWrapper = styled.div`
  position: relative;
`;

const Menu = styled.div`
  position: absolute;
  right: 0;
  top: 20px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  z-index: 10;
  min-width: 120px;
  animation: ${fadeIn} 0.15s ease-out;
`;

const MenuItem = styled.div`
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: #f3f4f6;
  }
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px;
  padding: 8px 12px;
  border: none;
  color: grey;
  font-size: 14px;
  cursor: pointer;
`;

const SmallButton = styled(Button)`
  margin: 0;
`;

const TitleInput = styled.input`
  flex: 1;
  font-size: 20px;
  font-weight: bold;
  padding: 8px 12px;
  border: none;
  outline: none;
`;

const MetaBar = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  justify-content: space-between;
`;

const MetaInfo = styled.div`
  display: flex;
  flex-direction: column;
  font-size: 12px;
  color: #6b7280;
`;

const TagSelect = styled.select`
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
`;

const SaveStatus = styled.div`
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #6b7280;
`;

const ToolbarWrapper = styled.div`
  display: flex;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
`;

const ToolbarButton = styled.button`
  background: ${(p) => (p.$active ? "#e0f2fe" : "transparent")};
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  color: #374151;

  &:hover {
    background: #f3f4f6;
  }
`;

const EditorBox = styled.div`
  flex: 1;
  padding: 16px;
  overflow-y: auto;

  .ProseMirror {
    min-height: 300px;
    outline: none;
  }
`;

const Placeholder = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #9ca3af;
  font-size: 14px;
`;
