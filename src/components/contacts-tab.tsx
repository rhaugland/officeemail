"use client";

import { useState, useEffect, useCallback } from "react";

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  companyName: string;
  companySize: number | null;
  companyLocation: string | null;
  industry: string | null;
  status: string;
  enrolledAt: string | null;
  repliedAt: string | null;
  optedOutAt: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-200 text-gray-800",
  approved: "bg-gray-800 text-white",
  rejected: "bg-gray-400 text-white",
  enrolled: "bg-gray-700 text-white",
  replied: "bg-gray-900 text-white",
  opted_out: "bg-gray-300 text-gray-600",
};

export function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importPage, setImportPage] = useState(1);
  const [filter, setFilter] = useState<string>("all");
  const [importResult, setImportResult] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const params = filter !== "all" ? `?status=${filter}` : "";
    const res = await fetch(`/api/contacts${params}`);
    const data = await res.json();
    setContacts(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

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
        setImportResult(`Imported ${data.imported}, skipped ${data.skipped} (page ${importPage})`);
        setImportPage((p) => p + 1);
        fetchContacts();
      } else {
        setImportResult(`Error: ${data.error}`);
      }
    } catch {
      setImportResult("Failed to connect to Apollo API");
    }
    setImporting(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchContacts();
  };

  const filters = ["all", "new", "approved", "enrolled", "replied", "opted_out", "rejected"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Contacts</h2>
          <span className="text-sm text-gray-500">({contacts.length})</span>
        </div>
        <div className="flex items-center gap-3">
          {importResult && (
            <span className="text-sm text-gray-600">{importResult}</span>
          )}
          <button
            onClick={importFromApollo}
            disabled={importing}
            className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {importing ? "Importing..." : `Import from Apollo (Page ${importPage})`}
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              filter === f
                ? "bg-black text-white"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {f === "opted_out" ? "Opted Out" : f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Size</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Location</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Industry</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    No contacts yet. Import from Apollo to get started.
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium">
                      {contact.firstName} {contact.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{contact.email}</td>
                    <td className="px-4 py-3 text-gray-600">{contact.title}</td>
                    <td className="px-4 py-3 text-gray-600">{contact.companyName}</td>
                    <td className="px-4 py-3 text-gray-600">{contact.companySize || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{contact.companyLocation || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{contact.industry || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          STATUS_COLORS[contact.status] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {contact.status === "opted_out" ? "Opted Out" : contact.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {contact.status === "new" && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateStatus(contact.id, "approved")}
                            className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors"
                            title="Approve for sequence"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => updateStatus(contact.id, "rejected")}
                            className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors"
                            title="Remove from list"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
