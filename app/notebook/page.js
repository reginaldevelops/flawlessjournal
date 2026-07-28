"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import TextAlign from "@tiptap/extension-text-align";
import { FolderPlus } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  Button,
  ConfirmDialog,
  Input,
  Modal,
  useToast,
} from "../components/ui";
import TagsSidebar from "../components/notebook/TagsSidebar";
import NotesSidebar from "../components/notebook/NotesSidebar";
import EditorPane from "../components/notebook/EditorPane";

const SAVE_DELAY = 550;

function noteKey(note) {
  return note?.clientId ?? note?.id ?? null;
}

function temporaryId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function NotebookPage() {
  const toast = useToast();
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [search, setSearch] = useState("");
  const [tagsLoading, setTagsLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [tagDialog, setTagDialog] = useState(null);
  const [tagName, setTagName] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  const [tagToDelete, setTagToDelete] = useState(null);
  const [noteDeleteOpen, setNoteDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const postsRef = useRef([]);
  const latestPostRef = useRef(null);
  const selectedTagRef = useRef(null);
  const saveTimerRef = useRef(null);
  const dirtyRef = useRef(false);
  const saveInFlightRef = useRef(null);
  const saveAgainRef = useRef(false);
  const flushSaveRef = useRef(null);
  const editorUpdateRef = useRef(null);
  const editorBlurRef = useRef(null);
  const loadedEditorKeyRef = useRef(null);
  const loadRequestRef = useRef(0);
  const mountedRef = useRef(true);

  const updatePosts = useCallback((updater) => {
    setPosts((previous) => {
      const next = typeof updater === "function" ? updater(previous) : updater;
      postsRef.current = next;
      return next;
    });
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        autolink: true,
        openOnClick: false,
        defaultProtocol: "https",
      }),
      Placeholder.configure({
        placeholder: "Start writing…",
        emptyEditorClass: "is-editor-empty",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      Typography,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap min-h-full focus:outline-none",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      editorUpdateRef.current?.(currentEditor.getHTML());
    },
    onBlur: () => {
      editorBlurRef.current?.();
    },
  });

  const scheduleSave = useCallback(() => {
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void flushSaveRef.current?.();
    }, SAVE_DELAY);
  }, []);

  const persistLatest = useCallback(async () => {
    window.clearTimeout(saveTimerRef.current);

    if (saveInFlightRef.current) {
      saveAgainRef.current = true;
      await saveInFlightRef.current;
      if (dirtyRef.current) return flushSaveRef.current?.();
      return true;
    }

    if (!dirtyRef.current || !latestPostRef.current) return true;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (mountedRef.current) setSaveStatus("error");
      return false;
    }

    const snapshot = { ...latestPostRef.current };
    const snapshotKey = noteKey(snapshot);
    const savedAt = new Date().toISOString();
    dirtyRef.current = false;
    saveAgainRef.current = false;

    updatePosts((currentPosts) =>
      currentPosts.map((post) =>
        noteKey(post) === snapshotKey ? { ...post, updated_at: savedAt } : post
      )
    );

    const operation = (async () => {
      if (!snapshot.id) {
        const { data, error } = await supabase
          .from("notebook")
          .insert([
            {
              title: snapshot.title?.trim() || "Untitled",
              content: snapshot.content || "",
              tag_id: snapshot.tag_id ?? selectedTagRef.current?.id,
              updated_at: savedAt,
            },
          ])
          .select("*")
          .single();

        if (error || !data) return { ok: false, error };

        updatePosts((currentPosts) => {
          let found = false;
          const next = currentPosts.map((post) => {
            if (noteKey(post) !== snapshotKey) return post;
            found = true;
            return {
              ...data,
              ...post,
              id: data.id,
              clientId: snapshot.clientId,
              updated_at: savedAt,
            };
          });
          return found
            ? next
            : [{ ...data, clientId: snapshot.clientId, updated_at: savedAt }, ...next];
        });

        if (noteKey(latestPostRef.current) === snapshotKey) {
          const merged = {
            ...data,
            ...latestPostRef.current,
            id: data.id,
            clientId: snapshot.clientId,
            updated_at: savedAt,
          };
          latestPostRef.current = merged;
          setSelectedPost((current) =>
            noteKey(current) === snapshotKey ? { ...merged } : current
          );
        }

        return { ok: true };
      }

      const { error } = await supabase
        .from("notebook")
        .update({
          title: snapshot.title?.trim() || "Untitled",
          content: snapshot.content || "",
          tag_id: snapshot.tag_id ?? selectedTagRef.current?.id,
          updated_at: savedAt,
        })
        .eq("id", snapshot.id);

      return { ok: !error, error };
    })();

    saveInFlightRef.current = operation;
    let result;
    try {
      result = await operation;
    } catch (error) {
      result = { ok: false, error };
    } finally {
      saveInFlightRef.current = null;
    }

    if (!result.ok) {
      dirtyRef.current = true;
      if (mountedRef.current) setSaveStatus("error");
      return false;
    }

    if (dirtyRef.current) {
      return flushSaveRef.current?.();
    }

    saveAgainRef.current = false;
    if (mountedRef.current) setSaveStatus("saved");
    return true;
  }, [updatePosts]);

  flushSaveRef.current = persistLatest;

  const updateDraft = useCallback(
    (patch) => {
      const current = latestPostRef.current;
      if (!current) return;

      const next = {
        ...current,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      const currentKey = noteKey(current);
      latestPostRef.current = next;
      dirtyRef.current = true;
      setSaveStatus(
        typeof navigator !== "undefined" && !navigator.onLine ? "error" : "saving"
      );
      setSelectedPost((post) => (noteKey(post) === currentKey ? { ...next } : post));
      updatePosts((currentPosts) =>
        currentPosts.map((post) =>
          noteKey(post) === currentKey
            ? {
                ...post,
                title: next.title,
                content: next.content,
                tag_id: next.tag_id,
                updated_at: next.updated_at,
              }
            : post
        )
      );
      scheduleSave();
    },
    [scheduleSave, updatePosts]
  );

  editorUpdateRef.current = (html) => updateDraft({ content: html });
  editorBlurRef.current = () => void flushSaveRef.current?.();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      void flushSaveRef.current?.();
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handleOffline = () => {
      if (dirtyRef.current) setSaveStatus("error");
    };
    const handleOnline = () => {
      if (!dirtyRef.current) return;
      setSaveStatus("saving");
      scheduleSave();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") void flushSaveRef.current?.();
    };
    const handlePageHide = () => {
      void flushSaveRef.current?.();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [scheduleSave]);

  useEffect(() => {
    let active = true;
    const loadTags = async () => {
      setTagsLoading(true);
      const { data, error } = await supabase
        .from("notebook_tags")
        .select("*")
        .order("created_at", { ascending: true });

      if (!active) return;
      setTagsLoading(false);
      if (error) {
        toast.error("Couldn’t load notebook tags", { description: error.message });
        return;
      }

      const nextTags = data || [];
      setTags(nextTags);
      const firstTag = nextTags[0] || null;
      selectedTagRef.current = firstTag;
      setSelectedTag(firstTag);
    };

    void loadTags();
    return () => {
      active = false;
    };
  }, [toast]);

  useEffect(() => {
    const tagId = selectedTag?.id;
    if (!tagId) {
      updatePosts([]);
      latestPostRef.current = null;
      setSelectedPost(null);
      setPostsLoading(false);
      return;
    }

    const requestId = ++loadRequestRef.current;
    setPostsLoading(true);
    setSearch("");

    const loadPosts = async () => {
      const { data, error } = await supabase
        .from("notebook")
        .select("*")
        .eq("tag_id", tagId)
        .order("updated_at", { ascending: false });

      if (requestId !== loadRequestRef.current) return;
      setPostsLoading(false);
      if (error) {
        toast.error("Couldn’t load notes", { description: error.message });
        return;
      }

      const nextPosts = data || [];
      updatePosts(nextPosts);
      const nextPost = nextPosts[0] || null;
      latestPostRef.current = nextPost;
      setSelectedPost(nextPost);
      setSaveStatus("saved");
    };

    void loadPosts();
  }, [selectedTag?.id, toast, updatePosts]);

  const selectedKey = noteKey(selectedPost);
  useEffect(() => {
    if (!editor) return;
    if (!selectedKey) {
      loadedEditorKeyRef.current = null;
      editor.commands.clearContent(false);
      return;
    }
    if (loadedEditorKeyRef.current === selectedKey) return;
    loadedEditorKeyRef.current = selectedKey;
    editor.commands.setContent(latestPostRef.current?.content || "", {
      emitUpdate: false,
    });
  }, [editor, selectedKey]);

  const selectPost = async (post) => {
    if (noteKey(post) === noteKey(latestPostRef.current)) return;
    const saved = await persistLatest();
    if (!saved) {
      toast.warning("This note hasn’t saved yet", {
        description: "Reconnect before switching notes.",
      });
      return;
    }
    latestPostRef.current = post;
    setSelectedPost(post);
    setSaveStatus("saved");
  };

  const selectTag = async (tag) => {
    if (tag.id === selectedTagRef.current?.id) return;
    const saved = await persistLatest();
    if (!saved) {
      toast.warning("This note hasn’t saved yet", {
        description: "Reconnect before switching tags.",
      });
      return;
    }
    loadRequestRef.current += 1;
    selectedTagRef.current = tag;
    setSelectedTag(tag);
    latestPostRef.current = null;
    setSelectedPost(null);
    updatePosts([]);
  };

  const createNote = async () => {
    const tag = selectedTagRef.current;
    if (!tag || postsLoading) return;
    const saved = await persistLatest();
    if (!saved) {
      toast.warning("This note hasn’t saved yet", {
        description: "Reconnect before creating another note.",
      });
      return;
    }

    const now = new Date().toISOString();
    const draft = {
      clientId: temporaryId(),
      title: "",
      content: "",
      tag_id: tag.id,
      created_at: now,
      updated_at: now,
    };
    latestPostRef.current = draft;
    dirtyRef.current = true;
    setSelectedPost(draft);
    updatePosts((currentPosts) => [draft, ...currentPosts]);
    setSearch("");
    setSaveStatus("saving");
    scheduleSave();
  };

  const changeTag = async (tagId) => {
    updateDraft({ tag_id: tagId });
    const saved = await persistLatest();
    if (!saved) return;
    const tag = tags.find((item) => String(item.id) === String(tagId));
    if (tag) {
      selectedTagRef.current = tag;
      setSelectedTag(tag);
    }
  };

  const deleteNote = async () => {
    let current = latestPostRef.current;
    if (!current) return;
    setDeleting(true);

    window.clearTimeout(saveTimerRef.current);
    if (saveInFlightRef.current) {
      try {
        await saveInFlightRef.current;
      } catch {
        // The delete below still removes the local draft when an insert failed.
      }
      current = latestPostRef.current;
    }

    if (!current.id) {
      dirtyRef.current = false;
    } else {
      const saved = await persistLatest();
      if (!saved) {
        setDeleting(false);
        toast.error("Couldn’t delete the note", {
          description: "Your latest changes are not saved.",
        });
        return;
      }
      const { error } = await supabase.from("notebook").delete().eq("id", current.id);
      if (error) {
        setDeleting(false);
        toast.error("Couldn’t delete the note", { description: error.message });
        return;
      }
    }

    const remaining = postsRef.current.filter(
      (post) => noteKey(post) !== noteKey(current)
    );
    updatePosts(remaining);
    const next = remaining[0] || null;
    latestPostRef.current = next;
    setSelectedPost(next);
    setSaveStatus("saved");
    setDeleting(false);
  };

  const openTagDialog = (mode, tag = null) => {
    setTagDialog({ mode, tag });
    setTagName(mode === "rename" ? tag.name : "");
  };

  const saveTag = async () => {
    const name = tagName.trim();
    if (!name) return;
    setTagSaving(true);

    if (tagDialog.mode === "add") {
      const { data, error } = await supabase
        .from("notebook_tags")
        .insert([{ name, fixed: false }])
        .select("*")
        .single();
      if (error || !data) {
        toast.error("Couldn’t add the tag", { description: error?.message });
        setTagSaving(false);
        return;
      }
      setTags((current) => [...current, data]);
    } else {
      const tag = tagDialog.tag;
      const { error } = await supabase
        .from("notebook_tags")
        .update({ name })
        .eq("id", tag.id);
      if (error) {
        toast.error("Couldn’t rename the tag", { description: error.message });
        setTagSaving(false);
        return;
      }
      setTags((current) =>
        current.map((item) => (item.id === tag.id ? { ...item, name } : item))
      );
      if (selectedTagRef.current?.id === tag.id) {
        const renamed = { ...selectedTagRef.current, name };
        selectedTagRef.current = renamed;
        setSelectedTag(renamed);
      }
    }

    setTagSaving(false);
    setTagDialog(null);
  };

  const deleteTag = async () => {
    const tag = tagToDelete;
    if (!tag || tag.fixed) return;
    setDeleting(true);
    const saved = await persistLatest();
    if (!saved) {
      setDeleting(false);
      toast.error("Couldn’t delete the tag", {
        description: "Your latest note changes are not saved.",
      });
      return;
    }
    const { error } = await supabase.from("notebook_tags").delete().eq("id", tag.id);
    if (error) {
      setDeleting(false);
      toast.error("Couldn’t delete the tag", { description: error.message });
      return;
    }

    const remainingTags = tags.filter((item) => item.id !== tag.id);
    setTags(remainingTags);
    if (selectedTagRef.current?.id === tag.id) {
      const nextTag = remainingTags[0] || null;
      selectedTagRef.current = nextTag;
      setSelectedTag(nextTag);
      latestPostRef.current = null;
      setSelectedPost(null);
      updatePosts([]);
    }
    setDeleting(false);
  };

  return (
    <>
      <div className="h-[calc(100dvh-var(--topbar-h))] min-h-[620px] w-full overflow-x-auto bg-canvas">
        <div className="grid h-full min-w-[1020px] grid-cols-[210px_292px_minmax(518px,1fr)] xl:grid-cols-[220px_310px_minmax(540px,1fr)]">
          <TagsSidebar
            tags={tags}
            selectedTag={selectedTag}
            loading={tagsLoading}
            onAdd={() => openTagDialog("add")}
            onSelect={selectTag}
            onRename={(tag) => openTagDialog("rename", tag)}
            onDelete={setTagToDelete}
          />
          <NotesSidebar
            selectedTag={selectedTag}
            posts={posts}
            selectedPost={selectedPost}
            search={search}
            loading={postsLoading}
            onSearch={setSearch}
            onNew={createNote}
            onSelect={selectPost}
          />
          <EditorPane
            editor={editor}
            post={selectedPost}
            tags={tags}
            saveStatus={saveStatus}
            onTitleChange={(title) => updateDraft({ title })}
            onTagChange={changeTag}
            onBlur={() => void persistLatest()}
            onDelete={() => setNoteDeleteOpen(true)}
          />
        </div>
      </div>

      <Modal
        open={Boolean(tagDialog)}
        onClose={() => setTagDialog(null)}
        title={tagDialog?.mode === "rename" ? "Rename tag" : "Create tag"}
        description="Use tags to keep related notes together."
        icon={FolderPlus}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setTagDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={tagSaving}
              disabled={!tagName.trim()}
              onClick={saveTag}
            >
              {tagDialog?.mode === "rename" ? "Save changes" : "Create tag"}
            </Button>
          </>
        }
      >
        <Input
          autoFocus
          value={tagName}
          onChange={(event) => setTagName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && tagName.trim()) void saveTag();
          }}
          placeholder="e.g. Trade ideas"
          aria-label="Tag name"
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(tagToDelete)}
        onClose={() => setTagToDelete(null)}
        onConfirm={deleteTag}
        title={`Delete “${tagToDelete?.name || "tag"}”?`}
        description="The tag will be removed permanently."
        confirmLabel="Delete tag"
        loading={deleting}
      />

      <ConfirmDialog
        open={noteDeleteOpen}
        onClose={() => setNoteDeleteOpen(false)}
        onConfirm={deleteNote}
        title="Delete this note?"
        description="The note and its content will be removed permanently."
        confirmLabel="Delete note"
        loading={deleting}
      />
    </>
  );
}
