"use client";

import { ContactsTab } from "@/components/contacts-tab";
import { SequencesTab } from "@/components/sequences-tab";

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight">OfficeEmail</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-12">
        <ContactsTab />
        <SequencesTab />
      </main>
    </div>
  );
}
