"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function signOut() {
    setError("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Account services are not configured.");
      return;
    }
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(`Could not sign out: ${signOutError.message}`);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return <div><button className="sidebar-back sidebar-sign-out" type="button" onClick={signOut}><LogOut size={17} /> Sign out</button>{error && <p className="sidebar-error" role="alert">{error}</p>}</div>;
}
