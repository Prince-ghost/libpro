import BookDetail from "@/components/books/BookDetail";

export const metadata = { title: "Book details" };

export default async function BookPage({ params }) {
  const { id } = await params;
  return <BookDetail id={id} />;
}