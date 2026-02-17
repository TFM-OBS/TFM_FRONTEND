import { BearingDashboard } from "@/components/bearing-dashboard";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <BearingDashboard />
      </div>
    </main>
  );
}
