"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import BookForm from "@/components/books/BookForm";

export default function SellForm() {
  const router = useRouter();

  async function create(payload) {
    await api("/api/books", { method: "POST", body: payload });
    router.push("/my-listings?created=1");
  }

  return (
    <BookForm
      onSubmit={create}
      submitLabel="Submit listing"
      busyLabel="Submitting…"
      cancelHref="/my-listings"
    />
  );
}