import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin · tıp_ai",
  description: "tıp_ai yönetim paneli",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-surface-soft text-ink antialiased">
      {children}
    </div>
  );
}
