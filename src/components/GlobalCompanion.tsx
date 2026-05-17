import { useRef, useEffect, useContext, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CompanionContext } from "@/contexts/CompanionContext";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, User, Loader2, Plus, Search, MoreHorizontal, Archive, Pencil, MessageSquare, Bookmark, Check } from "lucide-react";
import { ChatInputShell } from "@/components/chat/ChatInputShell";
import { AlbusAvatar } from "@/components/AlbusAvatar";
import { useDailyBriefing } from "@/hooks/useDailyBriefing";
import ReactMarkdown from "react-markdown";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { SaveToAppDialog, SAVE_DEST_LABELS, type SaveDestination } from "@/components/companion/SaveToAppDialog";

function relTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: false });
  } catch {
    return "";
  }
}

const TYPE_LABEL: Record<string, string> = {
  strategy: "Strategy",
  onboarding: "Onboarding",
  people: "People",
  general: "General",
};

export function GlobalCompanion() {
  const companionCtx = useContext(CompanionContext);
  const { isPrimaryAdmin } = useAuth();
  const { unread: briefingUnread } = useDailyBriefing();
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = companionCtx?.messages ?? [];
  const input = companionCtx?.input ?? "";
  const setInput = companionCtx?.setInput ?? (() => {});
  const loading = companionCtx?.loading ?? false;
  const open = companionCtx?.open ?? false;
  const setOpen = companionCtx?.setOpen ?? (() => {});
  const send = companionCtx?.send ?? (() => {});
  const threads = companionCtx?.threads ?? [];
  const activeThreadId = companionCtx?.activeThreadId ?? null;
  const selectThread = companionCtx?.selectThread ?? (async () => {});
  const newThread = companionCtx?.newThread ?? (() => {});
  const renameThread = companionCtx?.renameThread ?? (async () => {});
  const archiveThread = companionCtx?.archiveThread ?? (async () => {});
  const markMessageSaved = companionCtx?.markMessageSaved ?? (() => {});

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saveDialog, setSaveDialog] = useState<{ open: boolean; messageId: string | null; content: string }>({
    open: false,
    messageId: null,
    content: "",
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!companionCtx || !isPrimaryAdmin) return null;

  const filteredThreads = threads.filter((t) =>
    !search.trim() ? true : t.title.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditValue(currentTitle);
  };
  const commitEdit = async () => {
    if (editingId) {
      await renameThread(editingId, editValue);
    }
    setEditingId(null);
  };

  // The Albus launcher lives in AiToolsRail now. This component only renders
  // the chat sheet itself — opened by the rail or anywhere else via the
  // companion context's setOpen.
  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl flex p-0">
          {/* Thread sidebar */}
          <aside className="hidden sm:flex w-64 shrink-0 border-r border-border flex-col bg-muted/30">
            <div className="px-3 py-3 border-b border-border space-y-2">
              <button
                onClick={newThread}
                className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" />
                New Conversation
              </button>
              <div className="relative">
                <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations"
                  className="w-full bg-background rounded-md pl-7 pr-2 py-1.5 text-xs border border-border outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-1">
              {filteredThreads.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground/60">
                  {search ? "No matches" : "No conversations yet"}
                </div>
              )}
              {filteredThreads.map((t) => {
                const isActive = t.id === activeThreadId;
                return (
                  <div
                    key={t.id}
                    className={`group mx-2 my-0.5 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                      isActive ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                    onClick={() => editingId !== t.id && selectThread(t.id)}
                  >
                    <div className="flex items-start gap-1.5">
                      <MessageSquare className={`h-3 w-3 mt-1 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground/60"}`} />
                      <div className="flex-1 min-w-0">
                        {editingId === t.id ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-background border border-border rounded px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                          />
                        ) : (
                          <div
                            className={`text-xs font-medium truncate ${isActive ? "text-foreground" : "text-foreground/90"}`}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              startEdit(t.id, t.title);
                            }}
                            title="Double-click to rename"
                          >
                            {t.title}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 px-1 rounded bg-muted">
                            {TYPE_LABEL[t.thread_type] || t.thread_type}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60 truncate">
                            {relTime(t.last_message_at)}
                          </span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 rounded hover:bg-background flex items-center justify-center text-muted-foreground"
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(t.id, t.title);
                            }}
                          >
                            <Pencil className="h-3 w-3 mr-2" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              archiveThread(t.id);
                            }}
                          >
                            <Archive className="h-3 w-3 mr-2" /> Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Main chat */}
          <div className="flex-1 flex flex-col min-w-0">
            <SheetHeader className="px-5 py-4 border-b border-border">
              <SheetTitle className="flex items-center gap-2 text-base">
                <AlbusAvatar size="md" />
                Albus
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12 space-y-3">
                  <div className="flex justify-center"><AlbusAvatar size="2xl" /></div>
                  <p className="text-sm text-muted-foreground">Your chief of staff. Bring me decisions, blockers, or anything that's taking up space in your head.</p>
                  <div className="space-y-1.5">
                    {[
                      "What should I focus on today?",
                      "These things aren't working...",
                      "Help me think through a decision",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="block w-full text-left text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => {
                const isAssistant = msg.role === "assistant";
                const canSave = isAssistant && !!msg.id && !!msg.content?.trim() && !(loading && i === messages.length - 1);
                const savedLabel = msg.saved_to_type ? SAVE_DEST_LABELS[msg.saved_to_type as SaveDestination] : null;
                return (
                  <div key={msg.id ?? i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {isAssistant && (
                      <AlbusAvatar size="md" className="mt-0.5" />
                    )}
                    <div className="max-w-[85%] flex flex-col items-start gap-1">
                      <div className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground self-end"
                          : "bg-muted text-foreground"
                      }`}>
                        {isAssistant ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                      {isAssistant && (canSave || savedLabel) && (
                        <div className="flex items-center gap-2 px-1">
                          {savedLabel ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-primary/80 bg-primary/10 rounded-full px-2 py-0.5">
                              <Check className="h-2.5 w-2.5" />
                              Saved to {savedLabel}
                            </span>
                          ) : null}
                          {canSave && (
                            <button
                              onClick={() => setSaveDialog({ open: true, messageId: msg.id, content: msg.content })}
                              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors rounded-full px-2 py-0.5 hover:bg-muted"
                            >
                              <Bookmark className="h-2.5 w-2.5" />
                              {savedLabel ? "Save again →" : "Save →"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="h-6 w-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-3.5 w-3.5 text-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && !messages.some((m, i) => m.role === "assistant" && i === messages.length - 1) && (
                <div className="flex gap-2.5">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                  </div>
                  <div className="bg-muted rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground">Thinking...</div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="border-t border-border px-4 py-3">
              <ChatInputShell
                placeholder="What's on your mind? Type / for commands, @ to mention."
                submitting={loading}
                minHeight={48}
                onSubmit={async (p) => { await send(p.text); }}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <SaveToAppDialog
        open={saveDialog.open}
        onOpenChange={(v) => setSaveDialog((s) => ({ ...s, open: v }))}
        content={saveDialog.content}
        messageId={saveDialog.messageId}
        onSaved={(dest, savedId) => {
          if (saveDialog.messageId) markMessageSaved(saveDialog.messageId, dest, savedId);
        }}
      />
    </>
  );
}
