"use client";

import Link from "next/link";
import { useApiList } from "@/lib/use-api-list";

export default function AdminHome() {
  const pending = useApiList("/api/admin/books?moderationState=pending&limit=1");
  const waiting = pending.meta?.total;

  let waitingText = "Checking the queue…";
  if (typeof waiting === "number") waitingText = `${waiting} waiting for approval`;
  else if (pending.error) waitingText = "Could not load the count";

  const cards = [
    { href: "/admin/listings", title: "Listings", text: waitingText },
    { href: "/admin/orders", title: "Orders", text: "A read-only overview of every order." },
    { href: "/admin/users", title: "Users", text: "Find accounts and disable or enable them." },
    { href: "/admin/audit", title: "Audit log", text: "A record of every moderation and account decision." },
  ];

  return (
    <div>
      <p className="text-muted">Everything you do here is recorded in the audit log.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.href}>
            <Link href={card.href} className="block h-full rounded-2xl border border-line bg-surface p-4 hover:border-brand">
              <span className="font-serif text-lg font-bold">{card.title}</span>
              <span className="mt-1 block text-sm text-muted">{card.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}