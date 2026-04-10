import { createClient } from "@/app/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("getCurrentUser error:", error);
    return null;
  }

  return user;
}