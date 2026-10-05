"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RichEditor, insertVariableIntoEditor } from "@/components/rich-editor";

// ── Types ──────────────────────────────────────────────────────────────

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  title: string;
  companyName: string;
  companySize: number | null;
  companyLocation: string | null;
  industry: string | null;
  status: string;
  openCount: number;
  lastOpenedAt: string | null;
};


type Message = {
  id: string;
  contactId: string;
  direction: "inbound" | "outbound";
  subject: string;
  body: string;
  createdAt: string;
};

type Thread = {
  contact: { id: string; firstName: string; lastName: string; email: string; companyName: string; lastReadAt: string | null };
  messages: Message[];
};

type Phase = {
  id: string;
  phaseNumber: number;
  subject: string;
  body: string;
  isActive: boolean;
  delayDays: number;
  sentCount: number;
  eligibleCount: number;
};

type DashboardData = {
  contacts: { total: number; new: number; approved: number; enrolled: number; replied: number; optedOut: number };
  emails: { totalSent: number; sentToday: number; replies: number; replyRate: number };
};

type Sequence = {
  id: string;
  name: string;
  dailyLimit: number;
  phases: Phase[];
};

type SidebarView = "contacts" | "sequences";

// ── Icons ──────────────────────────────────────────────────────────────

function PersonIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "white" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SequenceIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "white" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-300",
  approved: "bg-green-500",
  rejected: "bg-red-400",
  enrolled: "bg-blue-500",
  replied: "bg-black",
  opted_out: "bg-gray-400",
};

const STATUS_DOT: Record<string, string> = {
  new: "bg-gray-300",
  approved: "bg-green-500",
  rejected: "bg-red-400",
  enrolled: "bg-blue-500",
  replied: "bg-black",
  opted_out: "bg-gray-400",
};

const VARIABLES = [
  { label: "First Name", value: "{{first_name}}" },
  { label: "Last Name", value: "{{last_name}}" },
  { label: "Company", value: "{{company}}" },
  { label: "Title", value: "{{title}}" },
];

// ── Main Page ──────────────────────────────────────────────────────────

export default function Home() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<"contacts" | "sequences" | null>(null);
  const [showSent, setShowSent] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("showSent") !== "false";
    }
    return true;
  });

  // Contact state
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Sequence state
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);
  const [showNewSequence, setShowNewSequence] = useState(false);
  const [newSeqName, setNewSeqName] = useState("");

  // Phase editor state
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editDelayDays, setEditDelayDays] = useState(0);
  const [saving, setSaving] = useState(false);
  const [addingPhase, setAddingPhase] = useState(false);
  const [phaseSubject, setPhaseSubject] = useState("");
  const [phaseBody, setPhaseBody] = useState("");
  const [lastFocused, setLastFocused] = useState<"subject" | "body">("body");

  // Send/test state
  const [sending, setSending] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testingPhase, setTestingPhase] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Reply state
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  // Import state
  const [importing, setImporting] = useState(false);
  const [importPage, setImportPage] = useState(1);
  const [importResult, setImportResult] = useState<string | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const editBodyEditorRef = useRef<HTMLDivElement>(null);

  // ── Data fetching ──

  const fetchContacts = useCallback(async () => {
    const res = await fetch("/api/contacts");
    const data = await res.json();
    setContacts(data);
  }, []);

  const fetchThreads = useCallback(async () => {
    const res = await fetch("/api/inbox");
    const data = await res.json();
    setThreads(data);
  }, []);

  const fetchSequences = useCallback(async () => {
    const res = await fetch("/api/sequences");
    const data = await res.json();
    setSequences(data);
  }, []);

  const fetchDashboard = useCallback(async () => {
    const res = await fetch("/api/dashboard");
    const data = await res.json();
    setDashboard(data);
  }, []);

  useEffect(() => {
    Promise.all([fetchContacts(), fetchThreads(), fetchSequences(), fetchDashboard()]).then(() =>
      setLoading(false)
    );
  }, [fetchContacts, fetchThreads, fetchSequences, fetchDashboard]);

  // ── Derived data ──

  const threadMap = useMemo(() => {
    const map = new Map<string, Thread>();
    for (const t of threads) map.set(t.contact.id, t);
    return map;
  }, [threads]);

  const filteredContacts = useMemo(() => {
    const result = contacts.filter((c) => {
      if (statusFilter === "has_thread") return threadMap.has(c.id);
      if (statusFilter === "enrolled") return c.status === "enrolled";
      if (statusFilter === "unenrolled") return c.status !== "enrolled" && c.status !== "opted_out";
      if (statusFilter && c.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Sort: inbound replies first, then outbound threads, then rest
    result.sort((a, b) => {
      const tA = threadMap.get(a.id);
      const tB = threadMap.get(b.id);
      const scoreA = tA?.messages.some((m) => m.direction === "inbound") ? 2 : tA ? 1 : 0;
      const scoreB = tB?.messages.some((m) => m.direction === "inbound") ? 2 : tB ? 1 : 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      if (tA && tB) return new Date(tB.messages[0].createdAt).getTime() - new Date(tA.messages[0].createdAt).getTime();
      return 0;
    });

    return result;
  }, [contacts, searchQuery, statusFilter, threadMap]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  const selectedThread = useMemo(
    () => threads.find((t) => t.contact.id === selectedContactId) || null,
    [threads, selectedContactId]
  );

  const selectedSequence = useMemo(
    () => sequences.find((s) => s.id === selectedSequenceId) || null,
    [sequences, selectedSequenceId]
  );

  // ── Contact actions ──

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchContacts();
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selected.size === 0) return;
    await fetch("/api/contacts/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), status }),
    });
    setSelected(new Set());
    fetchContacts();
  };

  const deleteContacts = async (ids: string[]) => {
    if (ids.length === 0) return;
    await fetch("/api/contacts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (selectedContactId && ids.includes(selectedContactId)) {
      setSelectedContactId(null);
    }
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    fetchContacts();
    fetchThreads();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const importFromApollo = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/apollo/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: importPage }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult(`+${data.imported} imported`);
        setImportPage((p) => p + 1);
        fetchContacts();
      } else {
        setImportResult(`Error: ${data.error}`);
      }
    } catch {
      setImportResult("Failed");
    }
    setImporting(false);
  };

  // ── Sequence actions ──

  const createSequence = async () => {
    if (!newSeqName.trim()) return;
    await fetch("/api/sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSeqName }),
    });
    setNewSeqName("");
    setShowNewSequence(false);
    fetchSequences();
  };

  const addPhaseToSequence = async () => {
    if (!selectedSequenceId || !phaseSubject.trim() || !phaseBody.trim()) return;
    await fetch(`/api/sequences/${selectedSequenceId}/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: phaseSubject, body: phaseBody }),
    });
    setPhaseSubject("");
    setPhaseBody("");
    setAddingPhase(false);
    fetchSequences();
  };

  const togglePhase = async (phaseId: string, isActive: boolean) => {
    if (!selectedSequenceId) return;
    await fetch(`/api/sequences/${selectedSequenceId}/phases`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phaseId, isActive: !isActive }),
    });
    fetchSequences();
  };

  const savePhase = async (phaseId: string) => {
    if (!selectedSequenceId) return;
    setSaving(true);
    await fetch(`/api/sequences/${selectedSequenceId}/phases/${phaseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: editSubject, body: editBody, delayDays: editDelayDays }),
    });
    setSaving(false);
    fetchSequences();
  };

  const sendPhase = async (phaseId: string) => {
    if (!selectedSequenceId) return;
    setSending(phaseId);
    setSendResult(null);
    try {
      const res = await fetch(`/api/sequences/${selectedSequenceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaseId }),
      });
      const data = await res.json();
      setSendResult(res.ok ? `Sent ${data.sent}` : `Error: ${data.error}`);
      fetchSequences();
      fetchThreads();
      fetchDashboard();
    } catch {
      setSendResult("Failed");
    }
    setSending(null);
  };

  const sendTest = async (phaseId: string) => {
    if (!selectedSequenceId || !testEmail.trim()) return;
    setTestingPhase(phaseId);
    setTestResult(null);
    try {
      const res = await fetch(`/api/sequences/${selectedSequenceId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaseId, email: testEmail }),
      });
      setTestResult(res.ok ? "Sent!" : "Failed");
      fetchThreads();
      setTimeout(() => setTestResult(null), 3000);
    } catch {
      setTestResult("Failed");
    }
    setTestingPhase(null);
  };

  // ── Reply actions ──

  const sendReply = async () => {
    if (!selectedContactId || !replyBody.trim()) return;
    setSendingReply(true);
    const thread = selectedThread;
    const lastSubject = thread?.messages[0]?.subject || "Follow up";
    const subject = lastSubject.startsWith("Re:") ? lastSubject : `Re: ${lastSubject}`;

    await fetch("/api/inbox/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: selectedContactId, subject, body: replyBody }),
    });
    setReplyBody("");
    setSendingReply(false);
    fetchThreads();
  };

  const toggleExpand = (msgId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      return next;
    });
  };

  // ── Helpers ──

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) return `${Math.floor(diffMs / 60000)}m`;
    if (diffHours < 24) return `${Math.floor(diffHours)}h`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const insertAtCursor = (value: string) => {
    if (lastFocused === "subject" && subjectRef.current) {
      const el = subjectRef.current;
      const start = el.selectionStart ?? editSubject.length;
      const end = el.selectionEnd ?? editSubject.length;
      setEditSubject(editSubject.slice(0, start) + value + editSubject.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + value.length, start + value.length);
      });
    } else {
      const el = editBodyEditorRef.current?.querySelector("[contenteditable]") as HTMLElement | null;
      insertVariableIntoEditor(el, value);
      requestAnimationFrame(() => {
        if (el) setEditBody(el.innerHTML);
      });
    }
  };

  // Threads sorted by most recent, inbound replies first
  const sortedThreads = useMemo(() => {
    return [...threads].sort((a, b) => {
      const aInbound = a.messages.some((m) => m.direction === "inbound") ? 1 : 0;
      const bInbound = b.messages.some((m) => m.direction === "inbound") ? 1 : 0;
      if (aInbound !== bInbound) return bInbound - aInbound;
      return new Date(b.messages[0].createdAt).getTime() - new Date(a.messages[0].createdAt).getTime();
    });
  }, [threads]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col">
      {/* Header - Desktop */}
      <header className="border-b border-gray-200 bg-white flex-shrink-0 hidden sm:block">
        <div className="flex items-center px-4 h-14">
          <h1 className="text-lg font-semibold tracking-tight">OfficeEmail</h1>
          {dashboard && (
            <div className="ml-8 flex items-center gap-6">
              <div className="text-center">
                <div className="text-lg font-semibold">{dashboard.contacts.total}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">Contacts</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{dashboard.contacts.enrolled}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">Enrolled</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{dashboard.emails.totalSent}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{dashboard.emails.sentToday}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">Today</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{dashboard.contacts.replied}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">Replies</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{dashboard.emails.replyRate}%</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">Rate</div>
              </div>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setPanel(panel === "contacts" ? null : "contacts")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${panel === "contacts" ? "bg-black text-white" : "text-gray-500 border border-gray-200 hover:bg-gray-50"}`}
            >
              Contacts ({contacts.length})
            </button>
            <button
              onClick={() => setPanel(panel === "sequences" ? null : "sequences")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${panel === "sequences" ? "bg-black text-white" : "text-gray-500 border border-gray-200 hover:bg-gray-50"}`}
            >
              Sequences ({sequences.length})
            </button>
          </div>
        </div>
      </header>

      {/* Header - Mobile */}
      <header className="border-b border-gray-200 bg-white flex-shrink-0 sm:hidden">
        <div className="flex items-center justify-between px-3 h-11">
          <h1 className="text-sm font-semibold tracking-tight">OE</h1>
          {dashboard && (
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-xs font-semibold">{dashboard.contacts.total}</div>
                <div className="text-[7px] text-gray-400 uppercase">Contacts</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold">{dashboard.contacts.enrolled}</div>
                <div className="text-[7px] text-gray-400 uppercase">Enrolled</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold">{dashboard.emails.totalSent}</div>
                <div className="text-[7px] text-gray-400 uppercase">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold">{dashboard.contacts.replied}</div>
                <div className="text-[7px] text-gray-400 uppercase">Replies</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold">{dashboard.emails.replyRate}%</div>
                <div className="text-[7px] text-gray-400 uppercase">Rate</div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPanel(panel === "contacts" ? null : "contacts")}
              className={`p-1.5 rounded-lg transition-colors ${panel === "contacts" ? "bg-black text-white" : "text-gray-500 border border-gray-200"}`}
            >
              <PersonIcon active={panel === "contacts"} />
            </button>
            <button
              onClick={() => setPanel(panel === "sequences" ? null : "sequences")}
              className={`p-1.5 rounded-lg transition-colors ${panel === "sequences" ? "bg-black text-white" : "text-gray-500 border border-gray-200"}`}
            >
              <SequenceIcon active={panel === "sequences"} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* ── Message Sidebar ── */}
        <div className={`w-full sm:w-[320px] border-r border-gray-200 bg-white flex flex-col flex-shrink-0 ${selectedContactId ? "hidden sm:flex" : "flex"}`}>
          <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Messages</div>
            <button onClick={() => { const next = !showSent; setShowSent(next); localStorage.setItem("showSent", String(next)); }} className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${showSent ? "bg-gray-100 text-gray-600" : "bg-black text-white"}`}>
              {showSent ? "Hide Sent" : "Replies Only"}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sortedThreads.filter((t) => showSent || t.messages.some((m) => m.direction === "inbound")).length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-400 text-xs">
                No conversations yet. Messages will appear here as emails are sent.
              </div>
            ) : (
              sortedThreads.filter((t) => showSent || t.messages.some((m) => m.direction === "inbound")).map((thread) => {
                const latest = thread.messages[0];
                const lastReadAt = thread.contact.lastReadAt ? new Date(thread.contact.lastReadAt) : null;
                const hasUnread = thread.messages.some((m) => m.direction === "inbound" && (!lastReadAt || new Date(m.createdAt) > lastReadAt));
                const isActive = selectedContactId === thread.contact.id;

                return (
                  <button
                    key={thread.contact.id}
                    onClick={() => {
                      setSelectedContactId(thread.contact.id);
                      setSelectedSequenceId(null);
                      setPanel(null);
                      if (hasUnread) {
                        fetch("/api/inbox/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: thread.contact.id }) });
                        thread.contact.lastReadAt = new Date().toISOString();
                        setThreads([...threads]);
                      }
                    }}
                    className={`w-full text-left px-3 py-3 border-b border-gray-50 transition-colors ${isActive ? "bg-gray-100" : "hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium truncate flex items-center gap-1.5">
                        {hasUnread && <span className="w-2 h-2 rounded-full bg-black flex-shrink-0" />}
                        {thread.contact.firstName} {thread.contact.lastName}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{formatTime(latest.createdAt)}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">{thread.contact.companyName}</div>
                    <div className="text-[10px] text-gray-400 truncate mt-0.5">
                      {latest.direction === "inbound" ? "" : "You: "}
                      {latest.body.slice(0, 60)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Main Area: Thread or Empty ── */}
        <div className={`flex-1 flex flex-col overflow-hidden bg-gray-50 ${selectedContactId ? "flex" : "hidden sm:flex"}`}>
          {selectedContact && selectedThread ? (
            <>
              {/* Contact header */}
              <div className="px-3 sm:px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => setSelectedContactId(null)} className="sm:hidden text-gray-500 p-1 -ml-1 flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  </button>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{selectedContact.firstName} {selectedContact.lastName}</div>
                    <div className="text-xs text-gray-500 truncate">
                      <span className="sm:hidden">{selectedContact.companyName}</span>
                      <span className="hidden sm:inline">{selectedContact.email} · {selectedContact.title} · {selectedContact.companyName}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize text-white ${STATUS_COLORS[selectedContact.status]}`}>
                    {selectedContact.status === "opted_out" ? "Opted Out" : selectedContact.status}
                  </span>
                  <button
                    onClick={() => { if (confirm(`Delete ${selectedContact.firstName} ${selectedContact.lastName}?`)) deleteContacts([selectedContact.id]); }}
                    className="px-2 py-1 text-[10px] font-medium text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-3">
                {[...selectedThread.messages].reverse().map((msg) => {
                  const isOutbound = msg.direction === "outbound";
                  const isExpanded = expandedMessages.has(msg.id);
                  return (
                    <div key={msg.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                      {isOutbound ? (
                        <div className="max-w-[85%] sm:max-w-[65%]">
                          <button onClick={() => toggleExpand(msg.id)} className="w-full text-left rounded-lg px-4 py-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-gray-400">You · {formatTime(msg.createdAt)}</span>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>
                            </div>
                            <div className="text-xs font-medium text-gray-500 mt-1">{msg.subject}</div>
                            {!isExpanded && <div className="text-[11px] text-gray-400 mt-1 truncate">{msg.body.slice(0, 60)}...</div>}
                          </button>
                          {isExpanded && <div className="mt-1 rounded-lg px-4 py-3 bg-white border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">{msg.body}</div>}
                        </div>
                      ) : (
                        <div className="max-w-[85%] sm:max-w-[65%] rounded-lg px-4 py-3 bg-black text-white">
                          <div className="text-[11px] opacity-60 mb-1">{selectedContact.firstName} · {formatTime(msg.createdAt)}</div>
                          <div className="text-sm whitespace-pre-wrap">{msg.body}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Reply */}
              <div className="border-t border-gray-200 bg-white px-3 sm:px-6 py-3 flex-shrink-0">
                <div className="flex gap-2">
                  <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write a reply..." rows={2} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gray-400" />
                  <button onClick={sendReply} disabled={sendingReply || !replyBody.trim()} className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 self-end">
                    {sendingReply ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a conversation to view messages
            </div>
          )}
        </div>

        {/* ── Slide-over Panels ── */}
        {panel && (
          <>
            <div className="absolute inset-0 bg-black/20 z-30" onClick={() => setPanel(null)} />
            <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[500px] bg-white border-l border-gray-200 z-40 flex flex-col shadow-xl">
              {panel === "contacts" ? (
                <>
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">Contacts</span>
                      <div className="relative">
                        <button onClick={() => setShowStatusFilter(!showStatusFilter)} className={`p-1 rounded border text-[10px] ${statusFilter ? "border-black bg-black text-white" : "border-gray-200 text-gray-400"}`}>
                          <FilterIcon />
                        </button>
                        {showStatusFilter && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowStatusFilter(false)} />
                            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[120px]">
                              {[{ value: "", label: "All" }, { value: "has_thread", label: "Inbox" }, { value: "enrolled", label: "Enrolled" }, { value: "unenrolled", label: "Unenrolled" }].map((s) => (
                                <button key={s.value} onClick={() => { setStatusFilter(s.value); setShowStatusFilter(false); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${statusFilter === s.value ? "font-medium text-black" : "text-gray-600"}`}>{s.label}</button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      {importResult && <span className="text-[10px] text-gray-500">{importResult}</span>}
                      <button onClick={importFromApollo} disabled={importing} className="px-2 py-1 text-[10px] font-medium text-gray-500 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50">
                        {importing ? "..." : "Import"}
                      </button>
                    </div>
                    <button onClick={() => setPanel(null)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
                  </div>
                  <div className="p-2 border-b border-gray-100">
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none" />
                  </div>
                  {selected.size > 0 && (
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                      <span className="text-xs font-medium">{selected.size} sel.</span>
                      <button onClick={() => bulkUpdateStatus("approved")} className="px-2 py-1 text-[10px] font-medium bg-black text-white rounded">Approve</button>
                      <button onClick={() => bulkUpdateStatus("rejected")} className="px-2 py-1 text-[10px] font-medium bg-white border border-gray-300 rounded">Reject</button>
                      <button onClick={() => { if (confirm(`Delete ${selected.size} contact(s)?`)) deleteContacts(Array.from(selected)); }} className="px-2 py-1 text-[10px] font-medium text-red-600 bg-white border border-red-200 rounded">Delete</button>
                      <button onClick={() => setSelected(new Set())} className="text-[10px] text-gray-500 ml-auto">Clear</button>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto">
                    {filteredContacts.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 hover:bg-gray-50">
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-3.5 h-3.5 accent-black" />
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedContactId(c.id); setSelectedSequenceId(null); setPanel(null); }}>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[c.status] || "bg-gray-300"}`} />
                            <span className="text-sm font-medium truncate">{c.firstName} {c.lastName}</span>
                            <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{c.status}</span>
                          </div>
                          <div className="text-[11px] text-gray-500 truncate pl-3.5">{c.title} · {c.companyName}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : panel === "sequences" ? (
                <>
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <span className="font-semibold text-sm">Sequences</span>
                    <button onClick={() => setPanel(null)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-3 border-b border-gray-100">
                      {showNewSequence ? (
                        <div className="flex gap-1.5">
                          <input value={newSeqName} onChange={(e) => setNewSeqName(e.target.value)} placeholder="Sequence name..." className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg" onKeyDown={(e) => e.key === "Enter" && createSequence()} />
                          <button onClick={createSequence} className="px-2.5 py-1.5 bg-black text-white text-xs rounded-lg">Create</button>
                          <button onClick={() => setShowNewSequence(false)} className="px-2 py-1.5 text-xs text-gray-500">X</button>
                        </div>
                      ) : (
                        <button onClick={() => setShowNewSequence(true)} className="w-full py-1.5 text-xs font-medium text-gray-600 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50">+ New Sequence</button>
                      )}
                    </div>
                    {sequences.map((seq) => (
                      <div key={seq.id} className="border-b border-gray-100">
                        <button onClick={() => { setSelectedSequenceId(selectedSequenceId === seq.id ? null : seq.id); }} className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${selectedSequenceId === seq.id ? "bg-gray-50" : ""}`}>
                          <div className="text-sm font-medium">{seq.name}</div>
                          <div className="text-[11px] text-gray-500">{seq.phases.length} phases · {seq.dailyLimit}/day · Auto at 8am CT</div>
                        </button>
                        {selectedSequenceId === seq.id && selectedSequence && (
                          <div className="px-4 pb-4 space-y-3">
                            <div className="flex flex-wrap gap-1">
                              {["MN", "IA", "MI", "WI", "OH", "IN", "SD", "ND", "CO", "AZ", "NV", "UT"].map((s) => (
                                <span key={s} className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 rounded text-gray-600">{s}</span>
                              ))}
                              <span className="text-[10px] text-gray-400 self-center ml-1">CHROs/CPOs · 25-2.5k</span>
                            </div>
                            {sendResult && <div className="text-xs text-gray-500">{sendResult}</div>}
                            {selectedSequence.phases.map((phase) => (
                              <div key={phase.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <div className="px-3 py-2 flex items-center justify-between">
                                  <button onClick={() => { if (expandedPhase === phase.id) { setExpandedPhase(null); return; } setExpandedPhase(phase.id); setEditSubject(phase.subject); setEditBody(phase.body); setEditDelayDays(phase.delayDays); }} className="flex-1 text-left">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded">P{phase.phaseNumber}</span>
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${phase.isActive ? "bg-black text-white" : "bg-gray-100 text-gray-500"}`}>{phase.isActive ? "On" : "Off"}</span>
                                      {phase.phaseNumber > 1 && <span className="text-[10px] text-gray-400">{phase.delayDays}d</span>}
                                      <span className="text-[10px] text-gray-400">{phase.sentCount} sent</span>
                                    </div>
                                    <p className="text-xs font-medium mt-1 truncate">{phase.subject}</p>
                                  </button>
                                  <div className="flex gap-1 ml-2">
                                    <button onClick={() => togglePhase(phase.id, phase.isActive)} className="px-2 py-1 text-[10px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50">{phase.isActive ? "Off" : "On"}</button>
                                    {phase.isActive && <button onClick={() => sendPhase(phase.id)} disabled={sending === phase.id} className="px-2 py-1 text-[10px] rounded bg-black text-white disabled:opacity-50">{sending === phase.id ? "..." : "Send"}</button>}
                                  </div>
                                </div>
                                {expandedPhase === phase.id && (
                                  <div className="px-3 pb-3 border-t border-gray-100 pt-2 bg-gray-50/50">
                                    <div className="flex items-center gap-1 mb-2">
                                      <span className="text-[9px] text-gray-400">Insert:</span>
                                      {VARIABLES.map((v) => (<button key={v.value} onClick={() => insertAtCursor(v.value)} className="px-1 py-0.5 text-[9px] font-mono bg-gray-100 rounded hover:bg-gray-200">{v.label}</button>))}
                                    </div>
                                    <input ref={subjectRef} value={editSubject} onChange={(e) => setEditSubject(e.target.value)} onFocus={() => setLastFocused("subject")} className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs mb-2 focus:outline-none" />
                                    <div ref={editBodyEditorRef}><RichEditor value={editBody} onChange={setEditBody} onFocus={() => setLastFocused("body")} placeholder="Email body..." /></div>
                                    {phase.phaseNumber > 1 && (
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] text-gray-500">Send</span>
                                        <input type="number" min={0} value={editDelayDays} onChange={(e) => setEditDelayDays(parseInt(e.target.value) || 0)} className="w-14 px-1.5 py-1 border border-gray-200 rounded text-[10px] text-center" />
                                        <span className="text-[10px] text-gray-500">days after prev phase</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                      <button onClick={() => savePhase(phase.id)} disabled={saving} className="px-2.5 py-1 bg-black text-white text-[10px] font-medium rounded disabled:opacity-50">{saving ? "..." : "Save"}</button>
                                      <button onClick={() => setExpandedPhase(null)} className="px-2.5 py-1 text-[10px] text-gray-500">Cancel</button>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-200">
                                      <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@email.com" className="px-2 py-1 border border-gray-200 rounded text-[10px] w-36" />
                                      <button onClick={() => sendTest(phase.id)} disabled={testingPhase === phase.id || !testEmail.trim()} className="px-2 py-1 text-[10px] border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">{testingPhase === phase.id ? "..." : "Test"}</button>
                                      {testResult && <span className="text-[10px] text-gray-500">{testResult}</span>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                            {addingPhase ? (
                              <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <input value={phaseSubject} onChange={(e) => setPhaseSubject(e.target.value)} placeholder="Subject line" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs mb-2" />
                                <RichEditor value={phaseBody} onChange={setPhaseBody} placeholder="Email body..." />
                                <div className="flex gap-2 mt-2">
                                  <button onClick={addPhaseToSequence} className="px-2.5 py-1 bg-black text-white text-[10px] font-medium rounded">Add</button>
                                  <button onClick={() => setAddingPhase(false)} className="px-2.5 py-1 text-[10px] text-gray-500">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setAddingPhase(true)} className="w-full py-2 text-[10px] font-medium text-gray-500 border border-dashed border-gray-300 rounded hover:bg-white">+ Add Phase</button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
