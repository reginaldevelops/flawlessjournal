"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { EditorContent, useEditor } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";

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

  // ✅ helper: veilige NL tijd
  function formatLocal(dateString) {
    if (!dateString) return "—";
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

  // Close tag menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenTagMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
        if (!selectedTag && data.length > 0) setSelectedTag(data[0]);
      }
    };
    loadTags();
  }, []);

  // Load posts when tag changes
  useEffect(() => {
    if (!selectedTag) return;
    const loadPosts = async () => {
      const { data, error } = await supabase
        .from("notebook")
        .select("*")
        .eq("tag_id", selectedTag.id)
        .order("updated_at", { ascending: false });
      if (!error) setPosts(data || []);
    };
    loadPosts();
  }, [selectedTag]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: true, // klikbare links
        autolink: true, // auto-detect URLs
        HTMLAttributes: {
          class: "text-blue-600 underline hover:text-blue-800", // Tailwind styling
        },
      }),
    ],
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
            updated_at: new Date().toISOString(),
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
          updated_at: new Date().toISOString(),
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
    if (!error && data) setTags([...tags, data]);
  };

  return (
    <div className="max-w-[1256px] w-full mx-auto min-h-[90vh]">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_3fr] h-[99vh]">
        {/* Tags column */}
        <div className="flex flex-col border-r border-gray-200 m-1 bg-gray-50">
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
            <button
              onClick={handleAddTag}
              className="flex items-center gap-1 text-sm text-gray-600"
            >
              <Tag size={18} /> Add tag
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tags.map((tag) => {
              const TagIcon =
                tag.name === "Monthly reviews"
                  ? Calendar
                  : tag.name === "Weekly reviews"
                    ? CalendarDays
                    : Tag;
              return (
                <div
                  key={tag.id}
                  onClick={() => setSelectedTag(tag)}
                  className={`flex items-center justify-between px-4 py-2 cursor-pointer ${
                    selectedTag?.id === tag.id
                      ? "bg-sky-100 border-l-4 border-sky-500"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TagIcon size={16} /> {tag.name}
                  </div>
                  {!tag.fixed && (
                    <div className="relative" ref={menuRef}>
                      <MoreVertical
                        size={16}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenTagMenu(
                            openTagMenu === tag.id ? null : tag.id
                          );
                        }}
                        className="cursor-pointer"
                      />
                      {openTagMenu === tag.id && (
                        <div className="absolute top-5 right-0 bg-white border rounded shadow-md text-sm z-10">
                          <div
                            className="px-3 py-1 hover:bg-gray-100 cursor-pointer"
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
                          </div>
                          <div
                            className="px-3 py-1 hover:bg-gray-100 cursor-pointer text-red-600"
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
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes column */}
        <div className="flex flex-col border-r border-gray-200 m-1 bg-gray-50">
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
            <button
              onClick={handleNewNote}
              className="flex items-center gap-1 text-sm text-gray-600"
            >
              <Newspaper size={18} /> New note
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => {
                  setSelectedPost(post);
                  editor?.commands.setContent(post.content);
                }}
                className={`flex items-center gap-2 px-4 py-2 cursor-pointer ${
                  selectedPost?.id === post.id
                    ? "bg-sky-100 border-l-4 border-sky-500"
                    : "hover:bg-gray-100"
                }`}
              >
                <FileText size={16} />
                <div>
                  <strong className="block text-gray-800">{post.title}</strong>
                  <small className="text-xs text-gray-500">
                    {formatLocal(post.updated_at || post.created_at)}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor column */}
        <div className="flex flex-col m-1 bg-gray-50 overflow-y-auto">
          {selectedPost ? (
            <>
              {/* Meta bar */}
              <div className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-white">
                <div className="flex items-center gap-2 flex-1">
                  <FileText size={20} />
                  <input
                    value={selectedPost.title}
                    onChange={(e) =>
                      setSelectedPost({
                        ...selectedPost,
                        title: e.target.value,
                      })
                    }
                    className="flex-1 text-lg font-semibold border-none outline-none"
                  />
                </div>

                <select
                  value={selectedPost.tag_id || ""}
                  onChange={(e) =>
                    setSelectedPost({ ...selectedPost, tag_id: e.target.value })
                  }
                  className="border rounded px-2 py-1 text-xs"
                >
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center text-xs text-gray-500">
                  {status.includes("Saving") ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} className="text-green-600" />
                  )}
                </div>

                <button
                  onClick={() => {
                    if (confirm("Delete this note?")) handleDeleteNote();
                  }}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  🗑️ Delete
                </button>
              </div>

              {/* Toolbar */}
              <div className="flex gap-1 px-2 py-1 border-b bg-gray-100">
                {[
                  {
                    icon: <Bold size={16} />,
                    action: () => editor.chain().focus().toggleBold().run(),
                    active: editor.isActive("bold"),
                  },
                  {
                    icon: <Italic size={16} />,
                    action: () => editor.chain().focus().toggleItalic().run(),
                    active: editor.isActive("italic"),
                  },
                  {
                    icon: <UnderlineIcon size={16} />,
                    action: () =>
                      editor.chain().focus().toggleUnderline().run(),
                    active: editor.isActive("underline"),
                  },
                  {
                    icon: <Heading1 size={16} />,
                    action: () =>
                      editor.chain().focus().toggleHeading({ level: 1 }).run(),
                    active: editor.isActive("heading", { level: 1 }),
                  },
                  {
                    icon: <Heading2 size={16} />,
                    action: () =>
                      editor.chain().focus().toggleHeading({ level: 2 }).run(),
                    active: editor.isActive("heading", { level: 2 }),
                  },
                  {
                    icon: <ListIcon size={16} />,
                    action: () =>
                      editor.chain().focus().toggleBulletList().run(),
                    active: editor.isActive("bulletList"),
                  },
                  {
                    icon: <ListOrdered size={16} />,
                    action: () =>
                      editor.chain().focus().toggleOrderedList().run(),
                    active: editor.isActive("orderedList"),
                  },
                  {
                    icon: <Quote size={16} />,
                    action: () =>
                      editor.chain().focus().toggleBlockquote().run(),
                    active: editor.isActive("blockquote"),
                  },
                  {
                    icon: <Code size={16} />,
                    action: () =>
                      editor.chain().focus().toggleCodeBlock().run(),
                    active: editor.isActive("codeBlock"),
                  },
                  {
                    icon: <Undo size={16} />,
                    action: () => editor.chain().focus().undo().run(),
                  },
                  {
                    icon: <Redo size={16} />,
                    action: () => editor.chain().focus().redo().run(),
                  },
                ].map((btn, i) => (
                  <button
                    key={i}
                    onClick={btn.action}
                    className={`p-1 rounded ${btn.active ? "bg-sky-100" : "hover:bg-gray-200"}`}
                  >
                    {btn.icon}
                  </button>
                ))}
              </div>

              <div className="flex-1 p-4 overflow-y-auto">
                <EditorContent
                  editor={editor}
                  className="prose max-w-none focus:outline-none leading-relaxed"
                  spellCheck={false}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select or create a note
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
