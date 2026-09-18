"use client";

import { useState, useEffect, useCallback } from "react";

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
                  <h4 className="text-sm font-medium mb-3">
                    New Phase {seq.phases.length + 1}
                  </h4>
                  <input
                    value={phaseSubject}
                    onChange={(e) => setPhaseSubject(e.target.value)}
                    placeholder="Email subject (use {{first_name}}, {{company}} for personalization)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <textarea
                    value={phaseBody}
                    onChange={(e) => setPhaseBody(e.target.value)}
                    placeholder="Email body HTML (use {{first_name}}, {{last_name}}, {{company}}, {{title}} for personalization)"
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-black resize-y"
                  />
                  <div className="flex gap-2">
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
                <div className="divide-y divide-gray-50">
                  {seq.phases.map((phase) => (
                    <div key={phase.id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex-1">
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
                        </div>
                        <p className="text-sm font-medium mt-1">{phase.subject}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => togglePhase(seq.id, phase.id, phase.isActive)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            phase.isActive
                              ? "border-gray-300 text-gray-600 hover:bg-gray-100"
                              : "border-gray-300 text-gray-900 hover:bg-gray-100"
                          }`}
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
