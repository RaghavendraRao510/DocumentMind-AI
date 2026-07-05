"use client";

import {
  BookOpenText,
  Bot,
  Check,
  ChevronRight,
  CircleHelp,
  Clipboard,
  FileSearch,
  FileText,
  Library,
  Loader2,
  LogOut,
  Menu,
  MessageSquarePlus,
  PanelRight,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

import api from "@/lib/api";
import { getApiErrorMessage } from "@/lib/errors";

type UploadedDocument = {
  id: number;
  filename: string;
  characters: number;
  chunks: number;
  preview: string;
};

type ChatMode = "research" | "summary" | "study";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  context?: string;
};

type ChatSession = {
  id: string;
  title: string;
  documentName?: string;
  messages: ChatMessage[];
};

type AskResponse = {
  question: string;
  answer: string;
  context?: string;
};

const chatHistoryKey = "documind-chat-history";
const documentsKey = "documind-documents";

const promptLibrary = [
  "Build a detailed research brief",
  "Summarize with evidence",
  "Find definitions and formulas",
  "Create exam revision notes",
  "List assumptions and limitations",
  "Turn this into action items",
];

const modes: { id: ChatMode; label: string; helper: string }[] = [
  {
    id: "research",
    label: "Research",
    helper: "Detailed answer with evidence and gaps",
  },
  {
    id: "summary",
    label: "Summary",
    helper: "Short direct answer",
  },
  {
    id: "study",
    label: "Study",
    helper: "Notes, definitions, and takeaways",
  },
];

const loadSaved = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") {
    return fallback;
  }

  const saved = window.localStorage.getItem(key);

  if (!saved) {
    return fallback;
  }

  try {
    return JSON.parse(saved) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
};

const cleanMarkdownNoise = (content: string) =>
  content
    .replace(/\*\*\s*\*\*/g, "")
    .replace(/^\s*\*{3,}\s*$/gm, "")
    .trim();

const renderInlineMarkdown = (text: string, keyPrefix: string): ReactNode[] => {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={key}
          className="rounded bg-[#eef1f4] px-1.5 py-0.5 font-mono text-[0.92em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-[#161616]">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return part;
  });
};

const renderAssistantContent = (content: string) => {
  const segments = cleanMarkdownNoise(content).split(/```/g);

  return segments.map((segment, segmentIndex) => {
    if (segmentIndex % 2 === 1) {
      const code = segment.replace(/^[a-zA-Z0-9_-]+\n/, "").trim();

      return (
        <pre
          key={`code-${segmentIndex}`}
          className="my-3 overflow-x-auto rounded-lg bg-[#171717] p-4 text-xs leading-6 text-white"
        >
          <code>{code}</code>
        </pre>
      );
    }

    const lines = segment
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.trim());

    const nodes: ReactNode[] = [];
    let listItems: string[] = [];

    const flushList = () => {
      if (!listItems.length) {
        return;
      }

      const ordered = listItems.every((item) => /^\d+\.\s+/.test(item));
      const Tag = ordered ? "ol" : "ul";

      nodes.push(
        <Tag
          key={`list-${segmentIndex}-${nodes.length}`}
          className={`my-3 space-y-2 pl-5 ${
            ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {listItems.map((item, itemIndex) => (
            <li key={`${segmentIndex}-${itemIndex}`}>
              {renderInlineMarkdown(
                item.replace(/^(\d+\.\s+|[-*]\s+)/, ""),
                `li-${segmentIndex}-${itemIndex}`,
              )}
            </li>
          ))}
        </Tag>,
      );

      listItems = [];
    };

    lines.forEach((line, lineIndex) => {
      if (/^(\d+\.\s+|[-*]\s+)/.test(line.trim())) {
        listItems.push(line.trim());
        return;
      }

      flushList();

      const heading = line.match(/^(#{1,3})\s+(.+)$/);

      if (heading) {
        nodes.push(
          <h3
            key={`heading-${segmentIndex}-${lineIndex}`}
            className="mb-2 mt-4 text-base font-semibold text-[#161616]"
          >
            {renderInlineMarkdown(
              heading[2],
              `heading-${segmentIndex}-${lineIndex}`,
            )}
          </h3>,
        );
        return;
      }

      nodes.push(
        <p key={`p-${segmentIndex}-${lineIndex}`} className="my-2">
          {renderInlineMarkdown(line, `p-${segmentIndex}-${lineIndex}`)}
        </p>,
      );
    });

    flushList();

    return (
      <div
        key={`text-${segmentIndex}`}
        className="first:[&>*]:mt-0 last:[&>*]:mb-0"
      >
        {nodes}
      </div>
    );
  });
};

const getModePrompt = (mode: ChatMode, question: string) => {
  if (mode === "summary") {
    return `Answer briefly in a clean format. Question: ${question}`;
  }

  if (mode === "study") {
    return `Create study notes with definitions, key points, and examples where possible. Question: ${question}`;
  }

  return `Research this from the uploaded document. Use a clear structure with key answer, evidence, details, and limitations. Question: ${question}`;
};

export default function Dashboard() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeDocument, setActiveDocument] = useState<UploadedDocument | null>(
    null,
  );
  const [documents, setDocuments] = useState<UploadedDocument[]>(() =>
    loadSaved<UploadedDocument[]>(documentsKey, []),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>(() =>
    loadSaved<ChatSession[]>(chatHistoryKey, []),
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<ChatMode>("research");
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [contextOpen, setContextOpen] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const latestContext = useMemo(
    () =>
      messages
        .slice()
        .reverse()
        .find((message) => message.role === "assistant" && message.context)
        ?.context,
    [messages],
  );

  const sourceSnippets = useMemo(() => {
    if (!latestContext) {
      return [];
    }

    return latestContext
      .split(/\n{2,}/)
      .map((snippet) => snippet.trim())
      .filter(Boolean)
      .slice(0, 5);
  }, [latestContext]);

  const activeMode = modes.find((item) => item.id === mode) || modes[0];

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, asking]);

  useEffect(() => {
    localStorage.setItem(chatHistoryKey, JSON.stringify(sessions.slice(0, 30)));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(documentsKey, JSON.stringify(documents.slice(0, 12)));
  }, [documents]);

  const startNewChat = () => {
    setMessages([]);
    setActiveSessionId(null);
    setQuestion("");
  };

  const saveChatSession = (nextMessages: ChatMessage[]) => {
    const firstQuestion =
      nextMessages.find((message) => message.role === "user")?.content ||
      "New research";
    const sessionId = activeSessionId || crypto.randomUUID();
    const nextSession: ChatSession = {
      id: sessionId,
      title:
        firstQuestion.length > 56
          ? `${firstQuestion.slice(0, 53).trim()}...`
          : firstQuestion,
      documentName: activeDocument?.filename,
      messages: nextMessages,
    };

    setActiveSessionId(sessionId);
    setSessions((current) => [
      nextSession,
      ...current.filter((session) => session.id !== sessionId),
    ]);
  };

  const uploadPdf = async () => {
    if (!selectedFile) {
      toast.error("Choose a PDF first");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setUploading(true);
      const res = await api.post<UploadedDocument>("/documents/upload", formData);
      setActiveDocument(res.data);
      setDocuments((current) => [
        res.data,
        ...current.filter((document) => document.id !== res.data.id),
      ]);
      startNewChat();
      toast.success("PDF indexed and ready");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const askQuestion = async (nextQuestion = question) => {
    const trimmedQuestion = nextQuestion.trim();

    if (!trimmedQuestion || asking) {
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmedQuestion,
    };
    const nextUserMessages = [...messages, userMessage];

    setMessages(nextUserMessages);
    saveChatSession(nextUserMessages);
    setQuestion("");

    try {
      setAsking(true);
      const res = await api.post<AskResponse>("/chat/ask", {
        question: getModePrompt(mode, trimmedQuestion),
      });
      const nextMessages: ChatMessage[] = [
        ...nextUserMessages,
        {
          role: "assistant",
          content: res.data.answer,
          context: res.data.context,
        },
      ];

      setMessages(nextMessages);
      saveChatSession(nextMessages);
    } catch (error: unknown) {
      const message = getApiErrorMessage(
        error,
        "Could not answer the question",
      );
      const nextMessages: ChatMessage[] = [
        ...nextUserMessages,
        { role: "assistant", content: message },
      ];

      toast.error(message);
      setMessages(nextMessages);
      saveChatSession(nextMessages);
    } finally {
      setAsking(false);
    }
  };

  const copyText = async (content: string, index: number) => {
    await navigator.clipboard.writeText(cleanMarkdownNoise(content));
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex(null), 1400);
  };

  const regenerate = () => {
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((message) => message.role === "user");

    if (lastUserMessage) {
      askQuestion(lastUserMessage.content);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#1f1f1f]">
      <Toaster position="top-right" />

      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[296px] border-r border-[#dedede] bg-[#f1f2f4] transition-transform duration-200 lg:static ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex h-14 items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111827] text-white">
                  <Sparkles size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold">DocuMind</p>
                  <p className="text-[11px] text-[#6d7178]">Research chat</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#62666d] hover:bg-white lg:hidden"
                aria-label="Close sidebar"
              >
                <X size={17} />
              </button>
            </div>

            <div className="px-3">
              <button
                onClick={startNewChat}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#111827] text-sm font-semibold text-white hover:bg-[#242b38]"
              >
                <MessageSquarePlus size={17} />
                New research
              </button>
            </div>

            <div className="mt-4 px-3">
              <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-normal text-[#6d7178]">
                <Library size={14} />
                Documents
              </div>

              <div className="space-y-2">
                {documents.slice(0, 4).map((document) => (
                  <button
                    key={document.id}
                    onClick={() => setActiveDocument(document)}
                    className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left ${
                      activeDocument?.id === document.id
                        ? "border-[#b7c7ec] bg-white"
                        : "border-transparent bg-transparent hover:bg-white"
                    }`}
                  >
                    <FileText
                      size={16}
                      className="mt-0.5 shrink-0 text-[#2f6fed]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {document.filename}
                      </span>
                      <span className="text-xs text-[#6d7178]">
                        {document.chunks} chunks
                      </span>
                    </span>
                  </button>
                ))}

                {!documents.length && (
                  <div className="rounded-lg border border-[#dedede] bg-white p-3 text-sm text-[#6d7178]">
                    Upload PDFs to build your research library.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto px-3 pb-3">
              <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-normal text-[#6d7178]">
                <BookOpenText size={14} />
                History
              </div>

              <div className="space-y-1.5">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group flex items-center gap-1 rounded-lg px-2 py-2 ${
                      activeSessionId === session.id
                        ? "bg-white"
                        : "hover:bg-white"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setActiveSessionId(session.id);
                        setMessages(session.messages);
                        setSidebarOpen(false);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium">
                        {session.title}
                      </p>
                      <p className="truncate text-xs text-[#6d7178]">
                        {session.documentName || "Saved chat"}
                      </p>
                    </button>
                    <button
                      onClick={() => {
                        setSessions((current) =>
                          current.filter((item) => item.id !== session.id),
                        );
                        if (activeSessionId === session.id) {
                          startNewChat();
                        }
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#777b82] opacity-100 hover:bg-[#f1f2f4] hover:text-[#c5221f] sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Delete chat"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}

                {!sessions.length && (
                  <div className="rounded-lg border border-[#dedede] bg-white p-3 text-sm text-[#6d7178]">
                    Your research history will be saved here.
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#dedede] p-3">
              <button
                onClick={logout}
                className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-[#555b64] hover:bg-white"
              >
                <LogOut size={17} />
                Logout
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-[#dedede] bg-white/90 px-3 backdrop-blur lg:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={() => setSidebarOpen((current) => !current)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#52575f] hover:bg-[#f1f2f4]"
                aria-label="Toggle navigation"
              >
                <Menu size={19} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {activeDocument?.filename || "No document selected"}
                </p>
                <p className="truncate text-xs text-[#6d7178]">
                  {activeMode.helper}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="hidden h-9 items-center gap-2 rounded-lg border border-[#d8dce2] bg-white px-3 text-sm font-medium hover:bg-[#f8f9fb] sm:flex"
              >
                <Upload size={16} />
                Upload
              </button>
              <button
                onClick={() => setContextOpen((current) => !current)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8dce2] bg-white text-[#52575f] hover:bg-[#f8f9fb]"
                aria-label="Toggle research panel"
              >
                <PanelRight size={17} />
              </button>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
            <main className="flex min-w-0 flex-col">
              <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-5">
                <div className="mb-4 flex flex-wrap gap-2">
                  {modes.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setMode(item.id)}
                      className={`h-9 rounded-full px-4 text-sm font-medium ${
                        mode === item.id
                          ? "bg-[#111827] text-white"
                          : "border border-[#d8dce2] bg-white text-[#4d535c] hover:bg-[#f8f9fb]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 space-y-6 pb-36">
                  {messages.length === 0 ? (
                    <section className="flex min-h-[calc(100vh-300px)] flex-col justify-center">
                      <div className="mb-8 max-w-3xl">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d8dce2] bg-white px-3 py-1.5 text-xs font-medium text-[#62666d]">
                          <FileSearch size={14} className="text-[#2f6fed]" />
                          Document-grounded research workspace
                        </div>
                        <h1 className="text-4xl font-semibold tracking-normal text-[#171717] sm:text-5xl">
                          Ask, compare, summarize, and study your PDFs.
                        </h1>
                        <p className="mt-4 text-base leading-7 text-[#62666d]">
                          Upload a document, choose a response mode, and use the
                          source panel to review the retrieved evidence behind
                          each answer.
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {promptLibrary.map((prompt) => (
                          <button
                            key={prompt}
                            onClick={() => askQuestion(prompt)}
                            className="group min-h-20 rounded-xl border border-[#d8dce2] bg-white px-4 py-3 text-left shadow-sm hover:border-[#b9c1ce]"
                          >
                            <span className="flex items-start justify-between gap-3">
                              <span className="text-sm font-semibold text-[#252a31]">
                                {prompt}
                              </span>
                              <ChevronRight
                                size={17}
                                className="mt-0.5 shrink-0 text-[#969ba3] group-hover:text-[#2f6fed]"
                              />
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : (
                    messages.map((message, index) => (
                      <article
                        key={`${message.role}-${index}`}
                        className={`flex gap-3 ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        {message.role === "assistant" && (
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9f0ff] text-[#2f6fed]">
                            <Bot size={16} />
                          </div>
                        )}

                        <div
                          className={`max-w-[min(760px,calc(100vw-64px))] overflow-hidden rounded-2xl px-5 py-4 text-sm leading-7 shadow-sm ${
                            message.role === "user"
                              ? "bg-[#111827] text-white"
                              : "border border-[#dedede] bg-white text-[#2d3137]"
                          }`}
                        >
                          {message.role === "assistant" ? (
                            <>
                              {renderAssistantContent(message.content)}
                              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#edf0f3] pt-3">
                                <button
                                  onClick={() => copyText(message.content, index)}
                                  className="flex h-8 items-center gap-2 rounded-lg border border-[#d8dce2] px-3 text-xs font-medium text-[#555b64] hover:bg-[#f8f9fb]"
                                >
                                  {copiedIndex === index ? (
                                    <Check size={14} />
                                  ) : (
                                    <Clipboard size={14} />
                                  )}
                                  {copiedIndex === index ? "Copied" : "Copy"}
                                </button>
                                <button
                                  onClick={regenerate}
                                  disabled={asking}
                                  className="flex h-8 items-center gap-2 rounded-lg border border-[#d8dce2] px-3 text-xs font-medium text-[#555b64] hover:bg-[#f8f9fb] disabled:opacity-60"
                                >
                                  <Sparkles size={14} />
                                  Regenerate
                                </button>
                              </div>
                            </>
                          ) : (
                            message.content
                          )}
                        </div>

                        {message.role === "user" && (
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dfe3e8] text-[#252a31]">
                            <UserRound size={15} />
                          </div>
                        )}
                      </article>
                    ))
                  )}

                  {asking && (
                    <article className="flex gap-3">
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9f0ff] text-[#2f6fed]">
                        <Bot size={16} />
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl border border-[#dedede] bg-white px-5 py-4 text-sm text-[#62666d] shadow-sm">
                        <Loader2 size={16} className="animate-spin" />
                        Researching document context
                      </div>
                    </article>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 border-t border-[#dedede] bg-[#f6f7f9]/95 px-4 py-4 backdrop-blur lg:left-[296px] lg:right-[340px]">
                <div className="mx-auto max-w-4xl">
                  <div className="rounded-2xl border border-[#d8dce2] bg-white p-2 shadow-lg shadow-slate-200/70">
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#555b64] hover:bg-[#f1f2f4] sm:hidden"
                        aria-label="Upload PDF"
                      >
                        <Upload size={18} />
                      </button>
                      <textarea
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            askQuestion();
                          }
                        }}
                        placeholder="Ask anything about your document"
                        rows={1}
                        className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-6 outline-none"
                      />
                      <button
                        onClick={() => askQuestion()}
                        disabled={asking || !question.trim()}
                        className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-white hover:bg-[#242b38] disabled:bg-[#c4c8cf]"
                        aria-label="Send question"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 text-xs text-[#6d7178]">
                      <span>
                        {activeDocument
                          ? `${activeDocument.chunks} chunks indexed`
                          : "Upload a PDF to enable grounded answers"}
                      </span>
                      <span>{activeMode.label} mode</span>
                    </div>
                  </div>
                </div>
              </div>
            </main>

            <aside
              className={`fixed inset-y-0 right-0 z-30 w-[340px] border-l border-[#dedede] bg-white transition-transform duration-200 lg:static ${
                contextOpen ? "translate-x-0" : "translate-x-full lg:hidden"
              }`}
            >
              <div className="flex h-full flex-col">
                <div className="flex h-14 items-center justify-between border-b border-[#dedede] px-4">
                  <div>
                    <p className="text-sm font-semibold">Research panel</p>
                    <p className="text-xs text-[#6d7178]">Sources and tools</p>
                  </div>
                  <button
                    onClick={() => setContextOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[#62666d] hover:bg-[#f1f2f4]"
                    aria-label="Close research panel"
                  >
                    <X size={17} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <section className="rounded-xl border border-[#dedede] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Upload size={16} className="text-[#2f6fed]" />
                      <h2 className="text-sm font-semibold">Upload PDF</h2>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(event) =>
                        setSelectedFile(event.target.files?.[0] || null)
                      }
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex min-h-24 w-full flex-col justify-center rounded-lg border border-dashed border-[#c5ccd6] px-3 text-left hover:border-[#2f6fed]"
                    >
                      <span className="break-words text-sm font-medium">
                        {selectedFile ? selectedFile.name : "Choose PDF"}
                      </span>
                      <span className="mt-1 text-xs text-[#6d7178]">
                        {selectedFile
                          ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                          : "Text-based PDF files only"}
                      </span>
                    </button>
                    <button
                      onClick={uploadPdf}
                      disabled={uploading}
                      className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#2f6fed] text-sm font-semibold text-white hover:bg-[#255fcf] disabled:bg-[#b9c1ce]"
                    >
                      {uploading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <FileSearch size={16} />
                      )}
                      {uploading ? "Indexing" : "Index document"}
                    </button>
                  </section>

                  <section className="mt-4 rounded-xl border border-[#dedede] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <FileText size={16} className="text-[#2f6fed]" />
                      <h2 className="text-sm font-semibold">Active document</h2>
                    </div>

                    {activeDocument ? (
                      <div>
                        <div className="flex items-start gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eaf1ff] text-[#2f6fed]">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">
                              {activeDocument.filename}
                            </p>
                            <p className="mt-1 text-xs text-[#6d7178]">
                              {activeDocument.characters.toLocaleString()} chars
                              · {activeDocument.chunks} chunks
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 max-h-32 overflow-hidden text-sm leading-6 text-[#555b64]">
                          {activeDocument.preview}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-[#6d7178]">
                        No active document. Upload a PDF or select one from the
                        document list.
                      </p>
                    )}
                  </section>

                  <section className="mt-4 rounded-xl border border-[#dedede] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Search size={16} className="text-[#2f6fed]" />
                      <h2 className="text-sm font-semibold">Retrieved sources</h2>
                    </div>

                    {sourceSnippets.length ? (
                      <div className="space-y-3">
                        {sourceSnippets.map((snippet, index) => (
                          <div
                            key={`${snippet.slice(0, 24)}-${index}`}
                            className="rounded-lg bg-[#f6f7f9] p-3"
                          >
                            <p className="mb-1 text-xs font-semibold text-[#2f6fed]">
                              Source {index + 1}
                            </p>
                            <p className="line-clamp-5 text-sm leading-6 text-[#4d535c]">
                              {snippet}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg bg-[#f6f7f9] p-3 text-sm leading-6 text-[#6d7178]">
                        Ask a question to see the retrieved document context.
                      </div>
                    )}
                  </section>

                  <section className="mt-4 rounded-xl border border-[#dedede] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <CircleHelp size={16} className="text-[#2f6fed]" />
                      <h2 className="text-sm font-semibold">Quick tools</h2>
                    </div>
                    <div className="grid gap-2">
                      {promptLibrary.slice(0, 4).map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => askQuestion(prompt)}
                          className="rounded-lg border border-[#d8dce2] px-3 py-2 text-left text-sm font-medium hover:bg-[#f8f9fb]"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
