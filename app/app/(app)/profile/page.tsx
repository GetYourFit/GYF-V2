import type { Metadata } from "next";

import { ProfileView } from "@/components/profile/profile-view";

export const metadata: Metadata = { title: "Profile · GYF" };

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="t-label text-[var(--text-faint)]">You</p>
        <h1 className="t-headline text-[var(--text)]">Profile</h1>
      </header>
      <ProfileView />
    </div>
  );
}
