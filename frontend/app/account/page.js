import RequireAuth from "@/components/auth/RequireAuth";
import AccountView from "@/components/account/AccountView";

export const metadata = { title: "My account" };

export default function AccountPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-serif text-3xl font-bold">My account</h1>
      <div className="mt-6">
        <RequireAuth>
          <AccountView />
        </RequireAuth>
      </div>
    </div>
  );
}