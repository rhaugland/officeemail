"use client";

import { useState, useEffect, useCallback } from "react";

type Message = {
  id: string;
  contactId: string;
  direction: "inbound" | "outbound";
  subject: string;
  body: string;
  createdAt: string;
};

type Thread = {
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    companyName: string;
  };
  messages: Message[];
};

export function InboxTab() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/inbox");
    const data = await res.json();
    setThreads(data);
    // Update selected thread if it exists
    if (selectedThread) {
      const updated = data.find(
        (t: Thread) => t.contact.id === selectedThread.contact.id
      );
      if (updated) setSelectedThread(updated);
    }
    setLoading(false);
  }, [selectedThread]);

  useEffect(() => {
    fetchThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendReply = async () => {
    if (!selectedThread || !replyBody.trim()) return;
    setSending(true);

    const lastMsg = selectedThread.messages[0];
    const subject = lastMsg.subject.startsWith("Re:")
      ? lastMsg.subject
      : `Re: ${lastMsg.subject}`;

    await fetch("/api/inbox/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: selectedThread.contact.id,
        subject,
        body: replyBody,
      }),
    });

    setReplyBody("");
    setSending(false);
    await fetchThreads();
  };

  const toggleExpand = (msgId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      const mins = Math.floor(diffMs / (1000 * 60));
      return `${mins}m ago`;
    }
    if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    }
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const hasInbound = (thread: Thread) =>
    thread.messages.some((m) => m.direction === "inbound");

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-12">Loading inbox...</div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">Inbox</h2>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex" style={{ height: "calc(100vh - 200px)" }}>
        {/* Thread list */}
        <div className="w-[360px] border-r border-gray-200 overflow-y-auto flex-shrink-0">
          {threads.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400 text-sm">
              No conversations yet. Threads will appear here when you send
              emails or receive replies.
            </div>
          ) : (
            threads.map((thread) => {
              const latest = thread.messages[0];
              const isSelected =
                selectedThread?.contact.id === thread.contact.id;
              const inbound = hasInbound(thread);

              return (
                <button
                  key={thread.contact.id}
                  onClick={() => setSelectedThread(thread)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    isSelected ? "bg-gray-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">
                      {inbound && (
                        <span className="inline-block w-2 h-2 rounded-full bg-black mr-2 flex-shrink-0" />
                      )}
                      {thread.contact.firstName} {thread.contact.lastName}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                      {formatTime(latest.createdAt)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate mb-1">
                    {thread.contact.companyName}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {latest.direction === "inbound" ? "" : "You: "}
                    {latest.body.slice(0, 80)}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Thread detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedThread ? (
            <>
              {/* Thread header */}
              <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
                <div className="font-medium">
                  {selectedThread.contact.firstName}{" "}
                  {selectedThread.contact.lastName}
                </div>
                <div className="text-sm text-gray-500">
                  {selectedThread.contact.email} &middot;{" "}
                  {selectedThread.contact.companyName}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {[...selectedThread.messages].reverse().map((msg) => {
                  const isOutbound = msg.direction === "outbound";
                  const isExpanded = expandedMessages.has(msg.id);

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${
                        isOutbound ? "justify-end" : "justify-start"
                      }`}
                    >
                      {isOutbound ? (
                        // Outbound: compact by default, expandable
                        <div className="max-w-[70%]">
                          <button
                            onClick={() => toggleExpand(msg.id)}
                            className="w-full text-left rounded-lg px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs">
                                You &middot; {formatTime(msg.createdAt)}
                              </span>
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className={`text-gray-400 transition-transform flex-shrink-0 ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </div>
                            <div className="text-xs font-medium text-gray-500 mt-1">
                              {msg.subject}
                            </div>
                            {!isExpanded && (
                              <div className="text-xs text-gray-400 mt-1 truncate">
                                {msg.body.slice(0, 60)}...
                              </div>
                            )}
                          </button>
                          {isExpanded && (
                            <div className="mt-1 rounded-lg px-4 py-3 bg-gray-50 border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">
                              {msg.body}
                            </div>
                          )}
                        </div>
                      ) : (
                        // Inbound: fully visible
                        <div className="max-w-[70%] rounded-lg px-4 py-3 bg-black text-white">
                          <div className="text-xs opacity-60 mb-1">
                            {selectedThread.contact.firstName} &middot;{" "}
                            {formatTime(msg.createdAt)}
                          </div>
                          <div className="text-sm whitespace-pre-wrap">
                            {msg.body}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Reply box */}
              <div className="border-t border-gray-200 px-6 py-4 flex-shrink-0">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write a reply..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:border-gray-400"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={sendReply}
                    disabled={sending || !replyBody.trim()}
                    className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {sending ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a conversation to view the thread
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
