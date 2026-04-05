import { Suspense } from "react";
import LoginClient from "./LoginClient";

function LoginFallback() {
  return (
    <div className="relative min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-[1200px] items-center justify-center px-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-sm text-white/70 backdrop-blur-xl">
          Loading login...
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  );
}