"use client";

import { useState } from "react";
import { ContactsTab } from "@/components/contacts-tab";
import { SequencesTab } from "@/components/sequences-tab";

type Tab = "contacts" | "sequences";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("contacts");

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">OfficeEmail</h1>
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab("contacts")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "contacts"
                  ? "bg-black text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Contacts
            </button>
            <button
              onClick={() => setActiveTab("sequences")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "sequences"
                  ? "bg-black text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Sequences
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "contacts" ? <ContactsTab /> : <SequencesTab />}
      </main>
    </div>
  );
}
