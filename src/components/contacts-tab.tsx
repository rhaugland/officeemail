"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

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

type FilterKey = "title" | "companyName" | "companyLocation" | "industry" | "status";

const FILTER_COLUMNS: { key: FilterKey; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "companyName", label: "Company" },
  { key: "companyLocation", label: "Location" },
  { key: "industry", label: "Industry" },
  { key: "status", label: "Status" },
];

function FilterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importPage, setImportPage] = useState(1);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    title: "",
    companyName: "",
    companyLocation: "",
    industry: "",
    status: "",
  });
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/contacts");
    const data = await res.json();
    setContacts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filterOptions = useMemo(() => {
    const opts: Record<FilterKey, string[]> = {
      title: [],
      companyName: [],
      companyLocation: [],
      industry: [],
      status: [],
    };
    for (const c of contacts) {
      for (const col of FILTER_COLUMNS) {
        const val = col.key === "status"
          ? (c.status === "opted_out" ? "Opted Out" : c.status)
          : (c[col.key] || "");
        if (val && !opts[col.key].includes(val)) {
          opts[col.key].push(val);
        }
      }
    }
    for (const key of Object.keys(opts) as FilterKey[]) {
      opts[key].sort();
    }
    return opts;
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      for (const col of FILTER_COLUMNS) {
        const filterVal = filters[col.key];
        if (!filterVal) continue;
        const cellVal = col.key === "status"
          ? (c.status === "opted_out" ? "Opted Out" : c.status)
          : (c[col.key] || "");
        if (cellVal !== filterVal) return false;
      }
      return true;
    });
  }, [contacts, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

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

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredContacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const clearFilters = () => {
    setFilters({ title: "", companyName: "", companyLocation: "", industry: "", status: "" });
  };

  const renderHeader = (label: string, filterKey?: FilterKey) => {
    if (!filterKey) {
      return <th className="text-left px-4 py-3 font-medium text-gray-500">{label}</th>;
    }

    const isActive = !!filters[filterKey];
    const isOpen = openFilter === filterKey;

    return (
      <th className="text-left px-4 py-3 font-medium text-gray-500 relative">
        <button
          onClick={() => setOpenFilter(isOpen ? null : filterKey)}
          className={`inline-flex items-center gap-1.5 hover:text-gray-900 transition-colors ${
            isActive ? "text-gray-900" : ""
          }`}
        >
          {label}
          <span className={isActive ? "text-black" : "text-gray-400"}>
            <FilterIcon />
          </span>
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpenFilter(null)} />
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px] max-h-[280px] overflow-y-auto">
              <button
                onClick={() => {
                  setFilters((f) => ({ ...f, [filterKey]: "" }));
                  setOpenFilter(null);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                  !filters[filterKey] ? "font-medium text-black" : "text-gray-600"
                }`}
              >
                All
              </button>
              {filterOptions[filterKey].map((val) => (
                <button
                  key={val}
                  onClick={() => {
                    setFilters((f) => ({ ...f, [filterKey]: val }));
                    setOpenFilter(null);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 capitalize ${
                    filters[filterKey] === val ? "font-medium text-black bg-gray-50" : "text-gray-600"
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </>
        )}
      </th>
    );
  };

  const allSelected = filteredContacts.length > 0 && selected.size === filteredContacts.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Contacts</h2>
          <span className="text-sm text-gray-500">
            ({filteredContacts.length}{activeFilterCount > 0 ? ` of ${contacts.length}` : ""})
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-black underline ml-1"
            >
              Clear filters
            </button>
          )}
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

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-gray-100 rounded-lg">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button
            onClick={() => bulkUpdateStatus("approved")}
            className="px-3 py-1.5 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Approve for Sequence
          </button>
          <button
            onClick={() => bulkUpdateStatus("rejected")}
            className="px-3 py-1.5 text-sm font-medium bg-white text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Remove from List
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-500 hover:text-black ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 accent-black"
                  />
                </th>
                {renderHeader("Name")}
                {renderHeader("Email")}
                {renderHeader("Title", "title")}
                {renderHeader("Company", "companyName")}
                <th className="text-left px-4 py-3 font-medium text-gray-500">Size</th>
                {renderHeader("Location", "companyLocation")}
                {renderHeader("Industry", "industry")}
                {renderHeader("Status", "status")}
                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    {contacts.length === 0
                      ? "No contacts yet. Import from Apollo to get started."
                      : "No contacts match the current filters."}
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 ${
                      selected.has(contact.id) ? "bg-gray-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(contact.id)}
                        onChange={() => toggleSelect(contact.id)}
                        className="w-4 h-4 rounded border-gray-300 accent-black"
                      />
                    </td>
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
