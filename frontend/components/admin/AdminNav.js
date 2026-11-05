"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit log" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="mt-4 flex flex-wrap gap-2">
      {SECTIONS.map((section) => {
        const active = section.href === "/admin" ? pathname === "/admin" : pathname.startsWith(section.href);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              active ? "border-brand bg-brand text-white" : "border-line hover:bg-surface"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}