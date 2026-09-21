"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RichEditor, insertVariableIntoEditor } from "./rich-editor";

type Phase = {
  id: string;
  phaseNumber: number;
  subject: string;
  body: string;
  isActive: boolean;
  sentCount: number;
};

type Sequence = {
  id: string;
  name: string;
  dailyLimit: number;
  phases: Phase[];
};

const VARIABLES = [
  { label: "First Name", value: "{{first_name}}" },
  { label: "Last Name", value: "{{last_name}}" },
  { label: "Company", value: "{{company}}" },
  { label: "Title", value: "{{title}}" },
];

function VariableBar({ onInsert }: { onInsert: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <span className="text-xs text-gray-400 mr-1">Insert:</span>
      {VARIABLES.map((v) => (
        <button
          key={v.value}
          type="button"
          onClick={() => onInsert(v.value)}
          className="px-2 py-0.5 text-xs font-mono bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

export function SequencesTab() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewSequence, setShowNewSequence] = useState(false);
  const [newName, setNewName] = useState("");
  const [addingPhase, setAddingPhase] = useState<string | null>(null);
  const [phaseSubject, setPhaseSubject] = useState("");
  const [phaseBody, setPhaseBody] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testingPhase, setTestingPhase] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const newSubjectRef = useRef<HTMLInputElement>(null);
  const editBodyEditorRef = useRef<HTMLDivElement>(null);
  const newBodyEditorRef = useRef<HTMLDivElement>(null);

  const [lastFocused, setLastFocused] = useState<"subject" | "body">("body");
  const [newLastFocused, setNewLastFocused] = useState<"subject" | "body">("body");

  const fetchSequences = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/sequences");
    const data = await res.json();
    setSequences(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSequences();
  }, [fetchSequences]);

  const createSequence = async () => {
    if (!newName.trim()) return;
    await fetch("/api/sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setNewName("");
    setShowNewSequence(false);
    fetchSequences();
  };

  const addPhase = async (sequenceId: string) => {
    if (!phaseSubject.trim() || !phaseBody.trim()) return;
    await fetch(`/api/sequences/${sequenceId}/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: phaseSubject, body: phaseBody }),
    });
    setPhaseSubject("");
    setPhaseBody("");
    setAddingPhase(null);
    fetchSequences();
  };

  const togglePhase = async (sequenceId: string, phaseId: string, isActive: boolean) => {
    await fetch(`/api/sequences/${sequenceId}/phases`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phaseId, isActive: !isActive }),
    });
    fetchSequences();
  };

  const sendPhase = async (sequenceId: string, phaseId: string) => {
    setSending(phaseId);
    setSendResult(null);
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaseId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendResult(`Sent ${data.sent} emails${data.errors ? `, ${data.errors.length} errors` : ""}`);
        fetchSequences();
      } else {
        setSendResult(`Error: ${data.error}`);
      }
    } catch {
      setSendResult("Failed to send");
    }
    setSending(null);
  };

  const openPhaseEditor = (phase: Phase) => {
    if (expandedPhase === phase.id) {
      setExpandedPhase(null);
      return;
    }
    setExpandedPhase(phase.id);
    setEditSubject(phase.subject);
    setEditBody(phase.body);
    setSaveResult(null);
  };

  const savePhase = async (sequenceId: string, phaseId: string) => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/phases/${phaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      });
      if (res.ok) {
        setSaveResult("Saved");
        fetchSequences();
        setTimeout(() => setSaveResult(null), 2000);
      } else {
        setSaveResult("Failed to save");
      }
    } catch {
      setSaveResult("Failed to save");
    }
    setSaving(false);
  };

  const sendTest = async (sequenceId: string, phaseId: string) => {
    if (!testEmail.trim()) return;
    setTestingPhase(phaseId);
    setTestResult(null);
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaseId, email: testEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult("Test sent!");
        setTimeout(() => setTestResult(null), 3000);
      } else {
        setTestResult(`Error: ${data.error}`);
      }
    } catch {
      setTestResult("Failed to send test");
    }
    setTestingPhase(null);
  };

  const insertAtCursor = (
    ref: React.RefObject<HTMLInputElement | null>,
    value: string,
    setter: (v: string) => void,
    current: string
  ) => {
    const el = ref.current;
    if (!el) {
      setter(current + value);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + value + current.slice(end);
    setter(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + value.length, start + value.length);
    });
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading sequences...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Sequences</h2>
        <button
          onClick={() => setShowNewSequence(true)}
          className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          New Sequence
        </button>
      </div>

      {sendResult && (
        <div className="mb-4 px-4 py-2 bg-gray-100 text-gray-800 text-sm rounded-lg">
          {sendResult}
        </div>
      )}

      {showNewSequence && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-medium mb-3">Create Sequence</h3>
          <div className="flex gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Sequence name (e.g. CHRO Outreach Q4)"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button
              onClick={createSequence}
              className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              Create
            </button>
            <button
              onClick={() => setShowNewSequence(false)}
              className="px-4 py-2 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {sequences.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No sequences yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-6">
          {sequences.map((seq) => (
            <div key={seq.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{seq.name}</h3>
                  <p className="text-sm text-gray-500">
                    {seq.phases.length} phase{seq.phases.length !== 1 ? "s" : ""} · {seq.dailyLimit}/day limit
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAddingPhase(addingPhase === seq.id ? null : seq.id);
                    setPhaseSubject("");
                    setPhaseBody("");
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  + Add Phase
                </button>
              </div>

              {addingPhase === seq.id && (
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h4 className="text-sm font-medium mb-2">
                    New Phase {seq.phases.length + 1}
                  </h4>
                  <VariableBar
                    onInsert={(v) => {
                      if (newLastFocused === "subject") {
                        insertAtCursor(newSubjectRef, v, setPhaseSubject, phaseSubject);
                      } else {
                        insertVariableIntoEditor(newBodyEditorRef.current?.querySelector("[contenteditable]") || null, v);
                        // Sync state after insert
                        requestAnimationFrame(() => {
                          const el = newBodyEditorRef.current?.querySelector("[contenteditable]");
                          if (el) setPhaseBody(el.innerHTML);
                        });
                      }
                    }}
                  />
                  <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
                  <input
                    ref={newSubjectRef}
                    value={phaseSubject}
                    onChange={(e) => setPhaseSubject(e.target.value)}
                    onFocus={() => setNewLastFocused("subject")}
                    placeholder="Email subject"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <label className="block text-xs font-medium text-gray-500 mb-1">Body</label>
                  <div ref={newBodyEditorRef}>
                    <RichEditor
                      value={phaseBody}
                      onChange={setPhaseBody}
                      onFocus={() => setNewLastFocused("body")}
                      placeholder="Start writing your email..."
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => addPhase(seq.id)}
                      className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800"
                    >
                      Add Phase
                    </button>
                    <button
                      onClick={() => setAddingPhase(null)}
                      className="px-4 py-2 text-gray-600 text-sm rounded-lg hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {seq.phases.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {seq.phases.map((phase) => (
                    <div key={phase.id}>
                      <div className="px-6 py-4 flex items-center justify-between">
                        <button
                          onClick={() => openPhaseEditor(phase)}
                          className="flex-1 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                              Phase {phase.phaseNumber}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                phase.isActive
                                  ? "bg-gray-900 text-white"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {phase.isActive ? "Active" : "Inactive"}
                            </span>
                            <span className="text-xs text-gray-400">
                              {phase.sentCount} sent
                            </span>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className={`text-gray-400 transition-transform ${
                                expandedPhase === phase.id ? "rotate-180" : ""
                              }`}
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
                          <p className="text-sm font-medium mt-1">{phase.subject}</p>
                        </button>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => togglePhase(seq.id, phase.id, phase.isActive)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                          >
                            {phase.isActive ? "Deactivate" : "Activate"}
                          </button>
                          {phase.isActive && (
                            <button
                              onClick={() => sendPhase(seq.id, phase.id)}
                              disabled={sending === phase.id}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                            >
                              {sending === phase.id ? "Sending..." : `Send Batch (${seq.dailyLimit})`}
                            </button>
                          )}
                        </div>
                      </div>

                      {expandedPhase === phase.id && (
                        <div className="px-6 pb-4 border-t border-gray-100 pt-4 bg-gray-50/50">
                          <VariableBar
                            onInsert={(v) => {
                              if (lastFocused === "subject") {
                                insertAtCursor(subjectRef, v, setEditSubject, editSubject);
                              } else {
                                insertVariableIntoEditor(editBodyEditorRef.current?.querySelector("[contenteditable]") || null, v);
                                requestAnimationFrame(() => {
                                  const el = editBodyEditorRef.current?.querySelector("[contenteditable]");
                                  if (el) setEditBody(el.innerHTML);
                                });
                              }
                            }}
                          />
                          <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
                          <input
                            ref={subjectRef}
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                            onFocus={() => setLastFocused("subject")}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-black"
                          />
                          <label className="block text-xs font-medium text-gray-500 mb-1">Body</label>
                          <div ref={editBodyEditorRef}>
                            <RichEditor
                              value={editBody}
                              onChange={setEditBody}
                              onFocus={() => setLastFocused("body")}
                              placeholder="Start writing your email..."
                            />
                          </div>
                          <div className="flex items-center gap-3 mt-3">
                            <button
                              onClick={() => savePhase(seq.id, phase.id)}
                              disabled={saving}
                              className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
                            >
                              {saving ? "Saving..." : "Save Changes"}
                            </button>
                            <button
                              onClick={() => setExpandedPhase(null)}
                              className="px-4 py-2 text-gray-600 text-sm rounded-lg hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                            {saveResult && (
                              <span className="text-sm text-gray-500">{saveResult}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                            <input
                              value={testEmail}
                              onChange={(e) => setTestEmail(e.target.value)}
                              placeholder="your@email.com"
                              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black w-64"
                            />
                            <button
                              onClick={() => sendTest(seq.id, phase.id)}
                              disabled={testingPhase === phase.id || !testEmail.trim()}
                              className="px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                            >
                              {testingPhase === phase.id ? "Sending..." : "Send Test"}
                            </button>
                            {testResult && (
                              <span className="text-sm text-gray-500">{testResult}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">
                  No phases yet. Add a phase to start building your sequence.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
