import { connection } from "next/server";
import { Suspense } from "react";
import { Workspace } from "@/components/workspace";
import { loadBoard } from "@/lib/data";
import { getOwnerId } from "@/lib/session";

export default function Page() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <Board />
    </Suspense>
  );
}

async function Board() {
  await connection();
  const data = await loadBoard(await getOwnerId());
  return <Workspace initial={data} />;
}

function BoardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
      <div className="h-9 w-32 animate-pulse rounded-xl bg-line" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-card/70" />
        ))}
      </div>
    </div>
  );
}
