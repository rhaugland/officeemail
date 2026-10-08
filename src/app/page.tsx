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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#0a0a0a" : "#6b6560"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SequenceIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#0a0a0a" : "#6b6560"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b6560" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-[#5a5550]",
  approved: "bg-emerald-500",
  rejected: "bg-[#e64664]",
  enrolled: "bg-[#ffb428]",
  replied: "bg-[#ff7846]",
  opted_out: "bg-[#3a3530]",
};

const STATUS_DOT: Record<string, string> = {
  new: "bg-[#5a5550]",
  approved: "bg-emerald-500",
  rejected: "bg-[#e64664]",
  enrolled: "bg-[#ffb428]",
  replied: "bg-[#ff7846]",
  opted_out: "bg-[#3a3530]",
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
      <div className="min-h-screen flex items-center justify-center text-[#5a5550] bg-[#0a0a0a]">
        Loading...
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-[#e8e0d8]">
      {/* Header - Desktop */}
      <header className="border-b border-[#1e1e1e] bg-[#0a0a0a] flex-shrink-0 hidden sm:block">
        <div className="flex items-center px-5 h-14">
          <h1 className="text-lg font-bold tracking-[-1px] text-[#e8e0d8]">OfficeEmail</h1>
          {dashboard && (
            <div className="ml-8 flex items-center gap-6">
              <div className="text-center">
                <div className="text-lg font-semibold text-[#e8e0d8]">{dashboard.contacts.total}</div>
                <div className="text-[10px] text-[#5a5550] uppercase tracking-[1px]">Contacts</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-[#e8e0d8]">{dashboard.contacts.enrolled}</div>
                <div className="text-[10px] text-[#5a5550] uppercase tracking-[1px]">Enrolled</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-[#e8e0d8]">{dashboard.emails.totalSent}</div>
                <div className="text-[10px] text-[#5a5550] uppercase tracking-[1px]">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-[#e8e0d8]">{dashboard.emails.sentToday}</div>
                <div className="text-[10px] text-[#5a5550] uppercase tracking-[1px]">Today</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-[#e8e0d8]">{dashboard.contacts.replied}</div>
                <div className="text-[10px] text-[#5a5550] uppercase tracking-[1px]">Replies</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-[#e8e0d8]">{dashboard.emails.replyRate}%</div>
                <div className="text-[10px] text-[#5a5550] uppercase tracking-[1px]">Rate</div>
              </div>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setPanel(panel === "contacts" ? null : "contacts")}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${panel === "contacts" ? "bg-gradient-to-r from-[#ffb428] to-[#e64664] text-[#0a0a0a]" : "text-[#6b6560] border border-[#2a2a2a] hover:border-[#3a3530]"}`}
            >
              Contacts ({contacts.length})
            </button>
            <button
              onClick={() => setPanel(panel === "sequences" ? null : "sequences")}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${panel === "sequences" ? "bg-gradient-to-r from-[#ffb428] to-[#e64664] text-[#0a0a0a]" : "text-[#6b6560] border border-[#2a2a2a] hover:border-[#3a3530]"}`}
            >
              Sequences ({sequences.length})
            </button>
          </div>
        </div>
      </header>

      {/* Header - Mobile */}
      <header className="border-b border-[#1e1e1e] bg-[#0a0a0a] flex-shrink-0 sm:hidden">
        <div className="flex items-center justify-between px-3 h-11">
          <h1 className="text-sm font-bold tracking-[-1px] text-[#e8e0d8]">OE</h1>
          {dashboard && (
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-xs font-semibold text-[#e8e0d8]">{dashboard.contacts.total}</div>
                <div className="text-[7px] text-[#5a5550] uppercase">Contacts</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-[#e8e0d8]">{dashboard.contacts.enrolled}</div>
                <div className="text-[7px] text-[#5a5550] uppercase">Enrolled</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-[#e8e0d8]">{dashboard.emails.totalSent}</div>
                <div className="text-[7px] text-[#5a5550] uppercase">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-[#e8e0d8]">{dashboard.contacts.replied}</div>
                <div className="text-[7px] text-[#5a5550] uppercase">Replies</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-[#e8e0d8]">{dashboard.emails.replyRate}%</div>
                <div className="text-[7px] text-[#5a5550] uppercase">Rate</div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPanel(panel === "contacts" ? null : "contacts")}
              className={`p-1.5 rounded-full transition-all ${panel === "contacts" ? "bg-gradient-to-r from-[#ffb428] to-[#e64664] text-[#0a0a0a]" : "text-[#6b6560] border border-[#2a2a2a]"}`}
            >
              <PersonIcon active={panel === "contacts"} />
            </button>
            <button
              onClick={() => setPanel(panel === "sequences" ? null : "sequences")}
              className={`p-1.5 rounded-full transition-all ${panel === "sequences" ? "bg-gradient-to-r from-[#ffb428] to-[#e64664] text-[#0a0a0a]" : "text-[#6b6560] border border-[#2a2a2a]"}`}
            >
              <SequenceIcon active={panel === "sequences"} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* ── Message Sidebar ── */}
        <div className={`w-full sm:w-[320px] border-r border-[#1e1e1e] bg-[#0a0a0a] flex flex-col flex-shrink-0 ${selectedContactId ? "hidden sm:flex" : "flex"}`}>
          <div className="px-3 py-2.5 border-b border-[#1e1e1e] flex items-center justify-between">
            <div className="text-[10px] font-medium text-[#5a5550] uppercase tracking-[1px]">Messages</div>
            <button onClick={() => { const next = !showSent; setShowSent(next); localStorage.setItem("showSent", String(next)); }} className={`text-[10px] font-medium px-3 py-1 rounded-full transition-all ${showSent ? "bg-[#1e1e1e] text-[#6b6560]" : "bg-gradient-to-r from-[#ffb428] to-[#e64664] text-[#0a0a0a]"}`}>
              {showSent ? "Hide Sent" : "Replies Only"}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sortedThreads.filter((t) => showSent || t.messages.some((m) => m.direction === "inbound")).length === 0 ? (
              <div className="px-4 py-12 text-center text-[#3a3530] text-xs">
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
                    className={`w-full text-left px-3 py-3 border-b border-[#1e1e1e]/60 transition-all ${isActive ? "bg-[#1e1e1e]" : "hover:bg-[#111]"}`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium truncate flex items-center gap-1.5 text-[#e8e0d8]">
                        {hasUnread && <span className="w-2 h-2 rounded-full bg-[#ffb428] flex-shrink-0" />}
                        {thread.contact.firstName} {thread.contact.lastName}
                      </span>
                      <span className="text-[10px] text-[#5a5550] flex-shrink-0 ml-2">{formatTime(latest.createdAt)}</span>
                    </div>
                    <div className="text-[11px] text-[#6b6560] truncate">{thread.contact.companyName}</div>
                    <div className="text-[10px] text-[#5a5550] truncate mt-0.5">
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
        <div className={`flex-1 flex flex-col overflow-hidden bg-[#111] ${selectedContactId ? "flex" : "hidden sm:flex"}`}>
          {selectedContact && selectedThread ? (
            <>
              {/* Contact header */}
              <div className="px-3 sm:px-6 py-3 bg-[#0a0a0a] border-b border-[#1e1e1e] flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => setSelectedContactId(null)} className="sm:hidden text-[#6b6560] p-1 -ml-1 flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  </button>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate text-[#e8e0d8]">{selectedContact.firstName} {selectedContact.lastName}</div>
                    <div className="text-xs text-[#6b6560] truncate">
                      <span className="sm:hidden">{selectedContact.companyName}</span>
                      <span className="hidden sm:inline">{selectedContact.email} · {selectedContact.title} · {selectedContact.companyName}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium capitalize text-[#0a0a0a] ${STATUS_COLORS[selectedContact.status]}`}>
                    {selectedContact.status === "opted_out" ? "Opted Out" : selectedContact.status}
                  </span>
                  <button
                    onClick={() => { if (confirm(`Delete ${selectedContact.firstName} ${selectedContact.lastName}?`)) deleteContacts([selectedContact.id]); }}
                    className="px-2 py-1 text-[10px] font-medium text-[#e64664] hover:text-[#ff7846] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Emails */}
              <div className="flex-1 overflow-y-auto">
                {[...selectedThread.messages].reverse().map((msg, i) => {
                  const isOutbound = msg.direction === "outbound";
                  const isCollapsed = !expandedMessages.has(msg.id) && i < selectedThread.messages.length - 1;
                  return (
                    <div key={msg.id} className="border-b border-[#1e1e1e] bg-[#111]">
                      <button onClick={() => toggleExpand(msg.id)} className="w-full text-left px-4 sm:px-8 py-3 hover:bg-[#1a1a1a] transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${isOutbound ? "bg-[#1e1e1e] text-[#6b6560]" : "bg-gradient-to-br from-[#ffb428] to-[#e64664] text-[#0a0a0a]"}`}>
                              {isOutbound ? "Y" : selectedContact.firstName[0]}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate text-[#e8e0d8]">
                                {isOutbound ? "You" : `${selectedContact.firstName} ${selectedContact.lastName}`}
                                {isCollapsed && <span className="text-[#5a5550] font-normal ml-2 text-xs">{msg.body.slice(0, 80)}...</span>}
                              </div>
                              {!isCollapsed && <div className="text-xs text-[#6b6560] truncate">{msg.subject}</div>}
                            </div>
                          </div>
                          <span className="text-[11px] text-[#5a5550] flex-shrink-0 ml-3">{formatTime(msg.createdAt)}</span>
                        </div>
                      </button>
                      {!isCollapsed && (
                        <div className="px-4 sm:px-8 pb-6 pl-[60px] sm:pl-[76px]">
                          <div className="text-sm text-[#e8e0d8] prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: msg.body }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Reply */}
              <div className="border-t border-[#1e1e1e] bg-[#0a0a0a] px-4 sm:px-8 py-4 flex-shrink-0">
                <div className="flex gap-3">
                  <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write a reply..." rows={3} className="flex-1 border border-[#2a2a2a] rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#ffb428]/30 focus:border-[#ffb428]/50 transition-all bg-[#111] text-[#e8e0d8] placeholder-[#3a3530]" />
                  <button onClick={sendReply} disabled={sendingReply || !replyBody.trim()} className="px-5 py-2 bg-gradient-to-r from-[#ffb428] to-[#e64664] text-[#0a0a0a] text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-40 self-end transition-all">
                    {sendingReply ? "..." : "Reply"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#3a3530] text-sm">
              Select a conversation to view messages
            </div>
          )}
        </div>

        {/* ── Slide-over Panels ── */}
        {panel && (
          <>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-30" onClick={() => setPanel(null)} />
            <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[500px] bg-[#111] border-l border-[#1e1e1e] z-40 flex flex-col shadow-2xl shadow-black/50 sm:rounded-l-2xl">
              {panel === "contacts" ? (
                <>
                  <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm text-[#e8e0d8]">Contacts</span>
                      <div className="relative">
                        <button onClick={() => setShowStatusFilter(!showStatusFilter)} className={`p-1 rounded-lg border text-[10px] transition-all ${statusFilter ? "border-[#ffb428] bg-[#ffb428] text-[#0a0a0a]" : "border-[#2a2a2a] text-[#6b6560]"}`}>
                          <FilterIcon />
                        </button>
                        {showStatusFilter && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowStatusFilter(false)} />
                            <div className="absolute left-0 top-full mt-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl shadow-lg shadow-black/30 z-20 min-w-[120px] overflow-hidden">
                              {[{ value: "", label: "All" }, { value: "has_thread", label: "Inbox" }, { value: "enrolled", label: "Enrolled" }, { value: "unenrolled", label: "Unenrolled" }].map((s) => (
                                <button key={s.value} onClick={() => { setStatusFilter(s.value); setShowStatusFilter(false); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#2a2a2a] transition-colors ${statusFilter === s.value ? "font-medium text-[#ffb428]" : "text-[#6b6560]"}`}>{s.label}</button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      {importResult && <span className="text-[10px] text-[#6b6560]">{importResult}</span>}
                      <button onClick={importFromApollo} disabled={importing} className="px-2.5 py-1 text-[10px] font-medium text-[#6b6560] border border-[#2a2a2a] rounded-full hover:border-[#3a3530] disabled:opacity-50 transition-all">
                        {importing ? "..." : "Import"}
                      </button>
                    </div>
                    <button onClick={() => setPanel(null)} className="text-[#5a5550] hover:text-[#e8e0d8] text-lg transition-colors">&times;</button>
                  </div>
                  <div className="p-2 border-b border-[#1e1e1e]">
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full px-3 py-2 text-xs border border-[#2a2a2a] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffb428]/30 focus:border-[#ffb428]/50 transition-all bg-[#0a0a0a] text-[#e8e0d8] placeholder-[#3a3530]" />
                  </div>
                  {selected.size > 0 && (
                    <div className="px-3 py-2 bg-[#1a1a1a] border-b border-[#1e1e1e] flex items-center gap-2">
                      <span className="text-xs font-medium text-[#e8e0d8]">{selected.size} sel.</span>
                      <button onClick={() => bulkUpdateStatus("approved")} className="px-2.5 py-1 text-[10px] font-medium bg-gradient-to-r from-[#ffb428] to-[#e64664] text-[#0a0a0a] rounded-full transition-all">Approve</button>
                      <button onClick={() => bulkUpdateStatus("rejected")} className="px-2.5 py-1 text-[10px] font-medium bg-[#1e1e1e] border border-[#2a2a2a] rounded-full text-[#6b6560] transition-all">Reject</button>
                      <button onClick={() => { if (confirm(`Delete ${selected.size} contact(s)?`)) deleteContacts(Array.from(selected)); }} className="px-2.5 py-1 text-[10px] font-medium text-[#e64664] bg-[#1e1e1e] border border-[#e64664]/30 rounded-full transition-all">Delete</button>
                      <button onClick={() => setSelected(new Set())} className="text-[10px] text-[#5a5550] ml-auto">Clear</button>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto">
                    {filteredContacts.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1e1e1e]/60 hover:bg-[#1a1a1a] transition-all">
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-3.5 h-3.5 accent-[#ffb428] rounded" />
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedContactId(c.id); setSelectedSequenceId(null); setPanel(null); }}>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[c.status] || "bg-[#3a3530]"}`} />
                            <span className="text-sm font-medium truncate text-[#e8e0d8]">{c.firstName} {c.lastName}</span>
                            <span className="text-[10px] text-[#5a5550] ml-auto flex-shrink-0">{c.status}</span>
                          </div>
                          <div className="text-[11px] text-[#6b6560] truncate pl-3.5">{c.title} · {c.companyName}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : panel === "sequences" ? (
                <>
                  <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between">
                    <span className="font-semibold text-sm text-[#e8e0d8]">Sequences</span>
                    <button onClick={() => setPanel(null)} className="text-[#5a5550] hover:text-[#e8e0d8] text-lg transition-colors">&times;</button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-3 border-b border-[#1e1e1e]">
                      {showNewSequence ? (
                        <div className="flex gap-1.5">
                          <input value={newSeqName} onChange={(e) => setNewSeqName(e.target.value)} placeholder="Sequence name..." className="flex-1 px-3 py-1.5 text-xs border border-[#2a2a2a] rounded-xl bg-[#0a0a0a] text-[#e8e0d8] placeholder-[#3a3530] focus:outline-none focus:ring-2 focus:ring-[#ffb428]/30 transition-all" onKeyDown={(e) => e.key === "Enter" && createSequence()} />
                          <button onClick={createSequence} className="px-3 py-1.5 bg-gradient-to-r from-[#ffb428] to-[#e64664] text-[#0a0a0a] text-xs font-semibold rounded-full transition-all">Create</button>
                          <button onClick={() => setShowNewSequence(false)} className="px-2 py-1.5 text-xs text-[#5a5550]">X</button>
                        </div>
                      ) : (
                        <button onClick={() => setShowNewSequence(true)} className="w-full py-2 text-xs font-medium text-[#6b6560] border border-dashed border-[#2a2a2a] rounded-xl hover:border-[#3a3530] hover:text-[#e8e0d8] transition-all">+ New Sequence</button>
                      )}
                    </div>
                    {sequences.map((seq) => (
                      <div key={seq.id} className="border-b border-[#1e1e1e]">
                        <button onClick={() => { setSelectedSequenceId(selectedSequenceId === seq.id ? null : seq.id); }} className={`w-full text-left px-4 py-3 hover:bg-[#1a1a1a] transition-all ${selectedSequenceId === seq.id ? "bg-[#1a1a1a]" : ""}`}>
                          <div className="text-sm font-medium text-[#e8e0d8]">{seq.name}</div>
                          <div className="text-[11px] text-[#6b6560]">{seq.phases.length} phases · {seq.dailyLimit}/day · Auto at 8am CT</div>
                        </button>
                        {selectedSequenceId === seq.id && selectedSequence && (
                          <div className="px-4 pb-4 space-y-3">
                            <div className="flex flex-wrap gap-1">
                              {["MN", "IA", "MI", "WI", "OH", "IN", "SD", "ND", "CO", "AZ", "NV", "UT"].map((s) => (
                                <span key={s} className="px-1.5 py-0.5 text-[10px] font-medium bg-[#1e1e1e] rounded-md text-[#6b6560]">{s}</span>
                              ))}
                              <span className="text-[10px] text-[#3a3530] self-center ml-1">CHROs/CPOs · 25-2.5k</span>
                            </div>
                            {sendResult && <div className="text-xs text-[#6b6560]">{sendResult}</div>}
                            {selectedSequence.phases.map((phase) => (
                              <div key={phase.id} className="bg-[#0a0a0a] rounded-xl border border-[#2a2a2a] overflow-hidden">
                                <div className="px-3 py-2.5 flex items-center justify-between">
                                  <button onClick={() => { if (expandedPhase === phase.id) { setExpandedPhase(null); return; } setExpandedPhase(phase.id); setEditSubject(phase.subject); setEditBody(phase.body); setEditDelayDays(phase.delayDays); }} className="flex-1 text-left">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-mono bg-[#1e1e1e] px-1.5 py-0.5 rounded-md text-[#6b6560]">P{phase.phaseNumber}</span>
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${phase.isActive ? "bg-emerald-500 text-[#0a0a0a]" : "bg-[#1e1e1e] text-[#5a5550]"}`}>{phase.isActive ? "On" : "Off"}</span>
                                      {phase.phaseNumber > 1 && <span className="text-[10px] text-[#5a5550]">{phase.delayDays}d</span>}
                                      <span className="text-[10px] text-[#5a5550]">{phase.sentCount} sent</span>
                                    </div>
                                    <p className="text-xs font-medium mt-1 truncate text-[#e8e0d8]">{phase.subject}</p>
                                  </button>
                                  <div className="flex gap-1 ml-2">
                                    <button onClick={() => togglePhase(phase.id, phase.isActive)} className="px-2 py-1 text-[10px] rounded-full border border-[#2a2a2a] text-[#6b6560] hover:border-[#3a3530] transition-all">{phase.isActive ? "Off" : "On"}</button>
                                    {phase.isActive && <button onClick={() => sendPhase(phase.id)} disabled={sending === phase.id} className="px-2.5 py-1 text-[10px] rounded-full bg-gradient-to-r from-[#ffb428] to-[#e64664] text-[#0a0a0a] font-medium disabled:opacity-50 transition-all">{sending === phase.id ? "..." : "Send"}</button>}
                                  </div>
                                </div>
                                {expandedPhase === phase.id && (
                                  <div className="px-3 pb-3 border-t border-[#1e1e1e] pt-2 bg-[#111]">
                                    <div className="flex items-center gap-1 mb-2">
                                      <span className="text-[9px] text-[#5a5550]">Insert:</span>
                                      {VARIABLES.map((v) => (<button key={v.value} onClick={() => insertAtCursor(v.value)} className="px-1.5 py-0.5 text-[9px] font-mono bg-[#0a0a0a] border border-[#2a2a2a] rounded-md text-[#6b6560] hover:border-[#3a3530] transition-all">{v.label}</button>))}
                                    </div>
                                    <input ref={subjectRef} value={editSubject} onChange={(e) => setEditSubject(e.target.value)} onFocus={() => setLastFocused("subject")} className="w-full px-2.5 py-1.5 border border-[#2a2a2a] rounded-lg text-xs mb-2 bg-[#0a0a0a] text-[#e8e0d8] focus:outline-none focus:ring-2 focus:ring-[#ffb428]/30 transition-all" />
                                    <div ref={editBodyEditorRef}><RichEditor value={editBody} onChange={setEditBody} onFocus={() => setLastFocused("body")} placeholder="Email body..." /></div>
                                    {phase.phaseNumber > 1 && (
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] text-[#6b6560]">Send</span>
                                        <input type="number" min={0} value={editDelayDays} onChange={(e) => setEditDelayDays(parseInt(e.target.value) || 0)} className="w-14 px-1.5 py-1 border border-[#2a2a2a] rounded-lg text-[10px] text-center bg-[#0a0a0a] text-[#e8e0d8] focus:outline-none focus:ring-2 focus:ring-[#ffb428]/30 transition-all" />
                                        <span className="text-[10px] text-[#6b6560]">days after prev phase</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                      <button onClick={() => savePhase(phase.id)} disabled={saving} className="px-3 py-1 bg-gradient-to-r from-[#ffb428] to-[#e64664] text-[#0a0a0a] text-[10px] font-semibold rounded-full disabled:opacity-50 transition-all">{saving ? "..." : "Save"}</button>
                                      <button onClick={() => setExpandedPhase(null)} className="px-2.5 py-1 text-[10px] text-[#5a5550]">Cancel</button>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#1e1e1e]">
                                      <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@email.com" className="px-2.5 py-1 border border-[#2a2a2a] rounded-full text-[10px] w-36 bg-[#0a0a0a] text-[#e8e0d8] placeholder-[#3a3530] focus:outline-none focus:ring-2 focus:ring-[#ffb428]/30 transition-all" />
                                      <button onClick={() => sendTest(phase.id)} disabled={testingPhase === phase.id || !testEmail.trim()} className="px-2.5 py-1 text-[10px] border border-[#2a2a2a] rounded-full text-[#6b6560] hover:border-[#3a3530] disabled:opacity-50 transition-all">{testingPhase === phase.id ? "..." : "Test"}</button>
                                      {testResult && <span className="text-[10px] text-[#6b6560]">{testResult}</span>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                            {addingPhase ? (
                              <div className="bg-[#0a0a0a] rounded-xl border border-[#2a2a2a] p-3">
                                <input value={phaseSubject} onChange={(e) => setPhaseSubject(e.target.value)} placeholder="Subject line" className="w-full px-2.5 py-1.5 border border-[#2a2a2a] rounded-lg text-xs mb-2 bg-[#111] text-[#e8e0d8] placeholder-[#3a3530] focus:outline-none focus:ring-2 focus:ring-[#ffb428]/30 transition-all" />
                                <RichEditor value={phaseBody} onChange={setPhaseBody} placeholder="Email body..." />
                                <div className="flex gap-2 mt-2">
                                  <button onClick={addPhaseToSequence} className="px-3 py-1 bg-gradient-to-r from-[#ffb428] to-[#e64664] text-[#0a0a0a] text-[10px] font-semibold rounded-full transition-all">Add</button>
                                  <button onClick={() => setAddingPhase(false)} className="px-2.5 py-1 text-[10px] text-[#5a5550]">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setAddingPhase(true)} className="w-full py-2 text-[10px] font-medium text-[#6b6560] border border-dashed border-[#2a2a2a] rounded-xl hover:border-[#3a3530] hover:text-[#e8e0d8] transition-all">+ Add Phase</button>
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
