import { UnlockForm } from "./unlock-form";

export const metadata = { title: "Unlock · flow" };

export default function UnlockPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <UnlockForm />
    </main>
  );
}
