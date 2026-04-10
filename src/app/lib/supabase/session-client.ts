import { createClient } from "@/app/lib/supabase/client";

export async function getCurrentUserClient() {
  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("getCurrentUserClient error:", error);
    return null;
  }

  return user;
}