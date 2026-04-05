import { Suspense } from "react";
import CreateVideoClient from "./CreateVideoClient";

function CreateVideoFallback() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-[1500px] items-center justify-center px-6 py-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-sm text-white/70 backdrop-blur-xl">
          Loading video workspace...
        </div>
      </div>
    </div>
  );
}

export default function CreateVideoPage() {
  return (
    <Suspense fallback={<CreateVideoFallback />}>
      <CreateVideoClient />
    </Suspense>
  );
}