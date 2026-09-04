"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Download, PlusCircle } from "lucide-react";
import { HandoverDocPanel } from "@/app/components/HandoverDocPanel";
import { LegalResearchModal } from "@/app/components/LegalResearchModal";
import { MessageBubble } from "@/app/components/MessageBubble";
import { OpenQuestionsPanel } from "@/app/components/OpenQuestionsPanel";
import { PHASE_LABELS, PhaseTabs } from "@/app/components/PhaseTabs";
import { RoleToggle } from "@/app/components/RoleToggle";
import { StatutoryChecklist } from "@/app/components/StatutoryChecklist";
import type { DomainKnowledge } from "@/app/lib/domain-knowledge";
import type { HandoverDraft } from "@/app/lib/draft";
import {
  type OpenQuestion,
  type QuestionStatus,
  parseQuestionsBlock,
} from "@/app/lib/questions-format";
import { WORK_TYPE_DEFS } from "@/app/lib/work-types";
import {
  type ArchivedSession,
  type HandoverMeta,
  type HandoverRole,
  type Message,
  type Phase,
  ROLE_LABEL,
  type SessionMeta,
  type WorkType,
} from "@/app/lib/types";

function formatLocalTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const PHASE_HINTS: Record<Phase, string> = {
  inventory:
    "例: 「来週、後任の佐藤さんに補助金交付事務を引き継ぎます。棚卸しを手伝ってください」",
  reconcile:
    "例（後任者）: 「引継書を読みました。支出負担行為担当官とは誰のことですか」",
  document: "例: 「ここまでの内容で引継書を生成してください」",
};

type RightTab = "doc" | "checklist" | "questions";

export default function Home() {
  const [handovers, setHandovers] = useState<HandoverMeta[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<Phase>("inventory");
  const [role, setRoleState] = useState<HandoverRole>("predecessor");
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<SessionMeta[]>([]);
  const [viewingArchive, setViewingArchive] = useState<ArchivedSession | null>(
    null,
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domainKnowledge, setDomainKnowledge] =
    useState<DomainKnowledge | null>(null);
  const [researchOpen, setResearchOpen] = useState(false);
  const [draft, setDraft] = useState<HandoverDraft | null>(null);
  const [questions, setQuestions] = useState<OpenQuestion[]>([]);
  const [rightTab, setRightTab] = useState<RightTab>("doc");
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const current = handovers.find((h) => h.slug === currentSlug) ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 役割は URL クエリ ?role= に載せる（1台のPCで2人が交代する際、
  // 片方をブラウザの別タブで開いてブックマークできるようにするため）。
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("role");
    if (r === "successor" || r === "predecessor") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoleState(r);
    }
  }, []);

  function setRole(r: HandoverRole) {
    setRoleState(r);
    const params = new URLSearchParams(window.location.search);
    params.set("role", r);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  const refreshHandovers = useCallback(async (): Promise<HandoverMeta[]> => {
    const res = await fetch("/api/handovers");
    if (!res.ok) throw new Error("引継ぎ案件一覧の取得に失敗");
    const data = (await res.json()) as { handovers: HandoverMeta[] };
    setHandovers(data.handovers);
    return data.handovers;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshHandovers()
      .then((list) => {
        if (list.length > 0) setCurrentSlug(list[0].slug);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [refreshHandovers]);

  const refreshHistory = useCallback(
    async (slug: string, phase: Phase): Promise<SessionMeta[]> => {
      const res = await fetch(`/api/handovers/${slug}/${phase}/history`);
      if (!res.ok) throw new Error("履歴一覧の取得に失敗");
      const data = (await res.json()) as { sessions: SessionMeta[] };
      setHistory(data.sessions);
      return data.sessions;
    },
    [],
  );

  const refreshDomainKnowledge = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/handovers/${slug}/domain-knowledge`);
      if (!res.ok) {
        setDomainKnowledge(null);
        return;
      }
      const data = (await res.json()) as {
        domainKnowledge: DomainKnowledge | null;
      };
      setDomainKnowledge(data.domainKnowledge);
    } catch {
      setDomainKnowledge(null);
    }
  }, []);

  const refreshDraft = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/handovers/${slug}/draft`);
      if (!res.ok) {
        setDraft(null);
        return;
      }
      const data = (await res.json()) as { draft: HandoverDraft | null };
      setDraft(data.draft);
    } catch {
      setDraft(null);
    }
  }, []);

  const refreshQuestions = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/handovers/${slug}/questions`);
      if (!res.ok) {
        setQuestions([]);
        return;
      }
      const data = (await res.json()) as { questions: OpenQuestion[] };
      setQuestions(data.questions);
    } catch {
      setQuestions([]);
    }
  }, []);

  useEffect(() => {
    if (!currentSlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDomainKnowledge(null);
      setDraft(null);
      setQuestions([]);
      return;
    }
    refreshDomainKnowledge(currentSlug);
    refreshDraft(currentSlug);
    refreshQuestions(currentSlug);
  }, [currentSlug, refreshDomainKnowledge, refreshDraft, refreshQuestions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewingArchive(null);
    if (!currentSlug) {
      setMessages([]);
      setHistory([]);
      return;
    }
    let cancelled = false;
    setLoadingPhase(true);
    Promise.all([
      fetch(`/api/handovers/${currentSlug}/${currentPhase}`).then(async (r) => {
        if (!r.ok) throw new Error(`load failed: ${r.status}`);
        return (await r.json()) as { conversation: { messages: Message[] } };
      }),
      refreshHistory(currentSlug, currentPhase),
    ])
      .then(([convRes]) => {
        if (!cancelled) setMessages(convRes.conversation.messages);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setMessages([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPhase(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentSlug, currentPhase, refreshHistory]);

  // フェーズ切替時、右ペインの既定タブを気の利いたものに寄せる。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (currentPhase === "reconcile") setRightTab("questions");
    if (currentPhase === "document") setRightTab("doc");
  }, [currentPhase]);

  async function persistMessages(slug: string, phase: Phase, msgs: Message[]) {
    try {
      await fetch(`/api/handovers/${slug}/${phase}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });
    } catch {
      setError("会話の保存に失敗しました（ローカル表示は維持）");
    }
  }

  async function handleDeleteHandover() {
    if (!currentSlug || streaming) return;
    const target = handovers.find((h) => h.slug === currentSlug);
    if (!target) return;
    if (!window.confirm(`引継ぎ案件「${target.name}」を完全に削除しますか？`)) {
      return;
    }
    try {
      await fetch(`/api/handovers/${currentSlug}`, { method: "DELETE" });
      const list = await refreshHandovers();
      setCurrentSlug(list.length > 0 ? list[0].slug : null);
      setCurrentPhase("inventory");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleRenameHandover() {
    if (!currentSlug || streaming || !current) return;
    const newName = window.prompt("新しい業務名を入力してください", current.name);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === current.name) return;
    try {
      const res = await fetch(`/api/handovers/${currentSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? `rename failed: ${res.status}`);
      }
      await refreshHandovers();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || streaming || !currentSlug || viewingArchive) return;
    setError(null);

    const userMsg: Message = { role: "user", content: trimmed, speaker: role };
    const next = [...messages, userMsg];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    let finalMessages: Message[] = next;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          slug: currentSlug,
          phase: currentPhase,
          role,
        }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let assistantReasoning = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]" || !data) continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta ?? {};
            let changed = false;
            if (typeof delta.content === "string" && delta.content.length > 0) {
              assistantContent += delta.content;
              changed = true;
            }
            if (
              typeof delta.reasoning_content === "string" &&
              delta.reasoning_content.length > 0
            ) {
              assistantReasoning += delta.reasoning_content;
              changed = true;
            }
            if (changed) {
              setMessages((msgs) => {
                const copy = [...msgs];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                  reasoning: assistantReasoning || undefined,
                };
                return copy;
              });
            }
          } catch {
            // ignore malformed lines
          }
        }
      }

      finalMessages = [
        ...next,
        {
          role: "assistant",
          content: assistantContent,
          ...(assistantReasoning ? { reasoning: assistantReasoning } : {}),
        },
      ];

      await persistMessages(currentSlug, currentPhase, finalMessages);
      await refreshHandovers();

      // 突合せフェーズ: AI 応答から handover-questions ブロックを抽出し、
      // 疑問キューへ自動登録する（research-loop.ts の parseToolCall と同じ
      // 「決まった形式だけ出させてアプリ側で処理する」規律の同型再利用）。
      if (currentPhase === "reconcile") {
        const extracted = parseQuestionsBlock(assistantContent);
        if (extracted.length > 0) {
          try {
            for (const item of extracted) {
              await fetch(`/api/handovers/${currentSlug}/questions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  question: item.question,
                  raisedBy: role,
                  section: item.section,
                }),
              });
            }
            await refreshQuestions(currentSlug);
          } catch {
            // 自動抽出の失敗はデモを止めない。手動登録は別途可能。
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMessages((msgs) => msgs.slice(0, -2));
      setInput(trimmed);
    } finally {
      setStreaming(false);
    }
  }

  async function handleEditMessage(index: number, newContent: string) {
    if (!currentSlug || streaming || viewingArchive) return;
    const updated = messages.map((m, i) =>
      i === index ? { ...m, content: newContent } : m,
    );
    setMessages(updated);
    await persistMessages(currentSlug, currentPhase, updated);
    await refreshHandovers();
  }

  async function handleNewSession() {
    if (!currentSlug || streaming || viewingArchive) return;
    if (messages.length === 0) return;
    if (
      !window.confirm(
        "現在のセッションをアーカイブして新規セッションを開始します。よろしいですか？",
      )
    ) {
      return;
    }
    try {
      const res = await fetch(
        `/api/handovers/${currentSlug}/${currentPhase}/history`,
        { method: "POST" },
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? `archive failed: ${res.status}`);
      }
      setMessages([]);
      setError(null);
      await Promise.all([
        refreshHistory(currentSlug, currentPhase),
        refreshHandovers(),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleViewArchive(sessionId: string) {
    if (!currentSlug || streaming) return;
    try {
      const res = await fetch(
        `/api/handovers/${currentSlug}/${currentPhase}/history/${sessionId}`,
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? `load failed: ${res.status}`);
      }
      const data = (await res.json()) as { session: ArchivedSession };
      setViewingArchive(data.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleBackToCurrent() {
    setViewingArchive(null);
  }

  async function handleDeleteArchive(sessionId: string) {
    if (!currentSlug || streaming) return;
    if (!window.confirm("この履歴セッションを削除しますか？")) return;
    try {
      await fetch(
        `/api/handovers/${currentSlug}/${currentPhase}/history/${sessionId}`,
        { method: "DELETE" },
      );
      if (viewingArchive?.id === sessionId) setViewingArchive(null);
      await refreshHistory(currentSlug, currentPhase);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSaveAsDraft() {
    if (!currentSlug) return;
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content.trim().length > 0);
    if (!lastAssistant) return;
    try {
      const res = await fetch(`/api/handovers/${currentSlug}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: lastAssistant.content,
          generatedBy: currentPhase,
          updatedByRole: role,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? `save failed: ${res.status}`);
      }
      await refreshDraft(currentSlug);
      setRightTab("doc");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function downloadDraft() {
    if (!draft || !current) return;
    const today = new Date().toISOString().slice(0, 10);
    const filename = `事務引継書__${current.name}__${today}.md`;
    const blob = new Blob([draft.content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleAskPredecessor(q: OpenQuestion) {
    setRole("predecessor");
    if (currentPhase !== "reconcile") setCurrentPhase("reconcile");
    setInput(q.question);
  }

  async function handleUpdateQuestionStatus(id: string, status: QuestionStatus) {
    if (!currentSlug) return;
    try {
      await fetch(`/api/handovers/${currentSlug}/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await refreshQuestions(currentSlug);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDeleteQuestion(id: string) {
    if (!currentSlug) return;
    try {
      await fetch(`/api/handovers/${currentSlug}/questions/${id}`, {
        method: "DELETE",
      });
      await refreshQuestions(currentSlug);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleSectionClick(title: string, hint: string) {
    setInput(`「${title}」がまだ埋まっていません。${hint}を教えてください。`);
  }

  const hasHandover = currentSlug !== null;
  const isReadOnly = viewingArchive !== null;
  const displayedMessages = viewingArchive ? viewingArchive.messages : messages;
  const openCount = questions.filter((q) => q.status === "open").length;
  const remaining = current ? daysUntil(current.effectiveDate) : null;

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                業務引継ぎグリル
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {current
                  ? [
                      current.organization,
                      current.predecessorName && current.successorName
                        ? `${current.predecessorName} → ${current.successorName}`
                        : null,
                      current.effectiveDate
                        ? `発令日 ${current.effectiveDate}${remaining !== null ? `（あと${remaining}日）` : ""}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" ／ ") || "官公庁 業務引継ぎ支援デモ"
                  : "官公庁 業務引継ぎ支援デモ"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={currentSlug ?? ""}
                onChange={(e) => {
                  setCurrentSlug(e.target.value || null);
                  setCurrentPhase("inventory");
                }}
                disabled={streaming || handovers.length === 0}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                {handovers.length === 0 && (
                  <option value="">案件未作成</option>
                )}
                {handovers.map((h) => (
                  <option key={h.slug} value={h.slug}>
                    {h.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setCreating(true)}
                disabled={streaming}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                + 新規
              </button>
              <button
                onClick={handleRenameHandover}
                disabled={streaming || !hasHandover}
                title="業務名を変更"
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                リネーム
              </button>
              <button
                onClick={handleDeleteHandover}
                disabled={streaming || !hasHandover}
                title="案件を削除"
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                削除
              </button>
            </div>
          </div>
          {hasHandover && current && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {WORK_TYPE_DEFS[current.workType].label}
                </span>
                <button
                  onClick={() => setResearchOpen(true)}
                  disabled={streaming}
                  title={
                    domainKnowledge
                      ? `「${domainKnowledge.query}」を ${formatLocalTime(domainKnowledge.generatedAt)} にリサーチ済み`
                      : "grill する前に法令・実務情報を集めて注入する"
                  }
                  className={`rounded-md border px-2 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                    domainKnowledge
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  <BookOpen className="inline-block h-3.5 w-3.5 mr-1 align-[-0.1em]" />
                  {domainKnowledge ? "リサーチ済み" : "法令・実務リサーチ"}
                </button>
                <RoleToggle role={role} onChange={setRole} disabled={streaming} />
                <PhaseTabs
                  phase={currentPhase}
                  onChange={setCurrentPhase}
                  disabled={streaming}
                />
              </div>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <select
                    value={viewingArchive?.id ?? ""}
                    onChange={(e) => {
                      if (e.target.value) handleViewArchive(e.target.value);
                      else handleBackToCurrent();
                    }}
                    disabled={streaming}
                    title="このフェーズのアーカイブ済みセッション"
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <option value="">現在のセッション</option>
                    {history.map((s) => (
                      <option key={s.id} value={s.id}>
                        履歴 {formatLocalTime(s.updatedAt)}（{s.messageCount}件）
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={handleNewSession}
                  disabled={streaming || isReadOnly || messages.length === 0}
                  title="現在のセッションをアーカイブし、新規セッションを開始"
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <PlusCircle className="inline-block h-3.5 w-3.5 mr-1 align-[-0.1em]" />
                  新規セッション
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex w-full flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-6xl flex-1 overflow-hidden px-6">
          {/* 左: チャット */}
          <div className="flex flex-1 flex-col overflow-hidden py-6 pr-4">
            <div className="flex flex-1 flex-col overflow-y-auto">
              {isReadOnly && viewingArchive && (
                <div className="mb-4 flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    アーカイブ閲覧中（編集・送信不可）:{" "}
                    <strong>{formatLocalTime(viewingArchive.updatedAt)}</strong>（
                    {viewingArchive.messages.length} 件）
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteArchive(viewingArchive.id)}
                      disabled={streaming}
                      className="rounded-md border border-amber-400 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-40 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900"
                    >
                      この履歴を削除
                    </button>
                    <button
                      onClick={handleBackToCurrent}
                      className="rounded-md bg-amber-700 px-2 py-1 text-xs font-medium text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
                    >
                      現在のセッションに戻る
                    </button>
                  </div>
                </div>
              )}
              {!hasHandover ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center text-zinc-500 dark:text-zinc-400">
                  <p className="text-sm">まず引継ぎ案件を作成してください。</p>
                  <p className="mt-2 text-xs">
                    右上の「+ 新規」から業務名・業務類型・組織・前任者/後任者・発令日を入力すると、
                    ①棚卸し ②突合せ ③引継書生成 の各フェーズが永続化されます。
                  </p>
                </div>
              ) : loadingPhase ? (
                <div className="flex flex-1 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
                  読み込み中…
                </div>
              ) : displayedMessages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center text-zinc-500 dark:text-zinc-400">
                  <p className="text-sm">
                    {PHASE_LABELS[currentPhase]} を始めましょう（{ROLE_LABEL[role]}として）
                  </p>
                  <p className="mt-2 text-xs">{PHASE_HINTS[currentPhase]}</p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col gap-4">
                  {displayedMessages.map((m, i) => {
                    const isStreaming =
                      !isReadOnly && streaming && i === displayedMessages.length - 1;
                    return (
                      <MessageBubble
                        key={i}
                        message={m}
                        streaming={isStreaming}
                        onEdit={
                          !isReadOnly && m.role === "assistant" && !isStreaming
                            ? (content) => handleEditMessage(i, content)
                            : undefined
                        }
                      />
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                  <strong>エラー:</strong> {error}
                </div>
              )}
            </div>

            {hasHandover && currentPhase === "document" && !isReadOnly && (
              <div className="flex justify-end border-t border-zinc-200 pt-2 dark:border-zinc-800">
                <button
                  onClick={handleSaveAsDraft}
                  disabled={streaming || messages.length === 0}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Download className="inline-block h-3.5 w-3.5 mr-1 align-[-0.1em]" />
                  最新の応答をドラフトとして保存
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex w-full gap-2 border-t border-zinc-200 pt-4 pb-2 dark:border-zinc-800"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  !hasHandover
                    ? "先に引継ぎ案件を作成してください"
                    : isReadOnly
                      ? "アーカイブ閲覧中は送信できません"
                      : `${ROLE_LABEL[role]}として入力 (Cmd/Ctrl + Enter で送信)`
                }
                rows={3}
                disabled={streaming || !hasHandover || isReadOnly}
                className="flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim() || !hasHandover || isReadOnly}
                className="self-end rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {streaming ? "送信中…" : "送信"}
              </button>
            </form>
          </div>

          {/* 右: 引継書 / 法定8節 / 疑問 */}
          {hasHandover && (
            <div className="flex w-96 shrink-0 flex-col overflow-hidden border-l border-zinc-200 py-6 pl-4 dark:border-zinc-800">
              <div className="mb-2 flex items-center gap-1 rounded-md bg-zinc-100 p-1 dark:bg-zinc-800">
                {(
                  [
                    ["doc", "引継書"],
                    ["checklist", "法定8節"],
                    ["questions", `疑問${openCount > 0 ? ` ${openCount}` : ""}`],
                  ] as [RightTab, string][]
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                      rightTab === tab
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-1 flex-col overflow-y-auto rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                {rightTab === "doc" && (
                  <HandoverDocPanel draft={draft} onDownload={downloadDraft} />
                )}
                {rightTab === "checklist" && (
                  <StatutoryChecklist
                    draftContent={draft?.content ?? null}
                    onSectionClick={handleSectionClick}
                  />
                )}
                {rightTab === "questions" && (
                  <OpenQuestionsPanel
                    questions={questions}
                    onAskPredecessor={handleAskPredecessor}
                    onUpdateStatus={handleUpdateQuestionStatus}
                    onDelete={handleDeleteQuestion}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {researchOpen && currentSlug && current && (
        <LegalResearchModal
          slug={currentSlug}
          workType={current.workType}
          defaultQuery={current.name}
          existing={domainKnowledge}
          onClose={() => setResearchOpen(false)}
          onSaved={() => {
            if (currentSlug) refreshDomainKnowledge(currentSlug);
          }}
        />
      )}

      {creating && (
        <NewHandoverForm
          onClose={() => setCreating(false)}
          onCreated={async (slug) => {
            setCreating(false);
            await refreshHandovers();
            setCurrentSlug(slug);
            setCurrentPhase("inventory");
            setError(null);
          }}
        />
      )}
    </div>
  );
}

function NewHandoverForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [name, setName] = useState("");
  const [workType, setWorkType] = useState<WorkType>("budget-execution");
  const [organization, setOrganization] = useState("");
  const [predecessorName, setPredecessorName] = useState("");
  const [successorName, setSuccessorName] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("業務名を入力してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/handovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          workType,
          organization: organization.trim() || undefined,
          predecessorName: predecessorName.trim() || undefined,
          successorName: successorName.trim() || undefined,
          effectiveDate: effectiveDate || undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? `create failed: ${res.status}`);
      }
      const data = (await res.json()) as { handover: { slug: string } };
      onCreated(data.handover.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          新規 引継ぎ案件
        </h2>
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              業務名 *
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 補助金交付事務"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              業務類型 *
            </span>
            <div className="flex gap-2">
              {(
                [
                  ["budget-execution", "予算執行型"],
                  ["law-enforcement", "法執行型"],
                ] as [WorkType, string][]
              ).map(([wt, label]) => (
                <button
                  key={wt}
                  type="button"
                  onClick={() => setWorkType(wt)}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
                    workType === wt
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              組織
            </span>
            <input
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="例: 〇〇省〇〇局補助金課"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                前任者
              </span>
              <input
                value={predecessorName}
                onChange={(e) => setPredecessorName(e.target.value)}
                placeholder="例: 田中"
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                後任者
              </span>
              <input
                value={successorName}
                onChange={(e) => setSuccessorName(e.target.value)}
                placeholder="例: 佐藤"
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              発令日
            </span>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
        </div>
        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            キャンセル
          </button>
          <button
            onClick={submit}
            disabled={submitting || !name.trim()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {submitting ? "作成中…" : "作成"}
          </button>
        </div>
      </div>
    </div>
  );
}
