import dynamic from "next/dynamic";

const WorkoutVoiceCoach = dynamic(() => import("@/app/components/WorkoutVoiceCoach"), { ssr: false });

export default function WorkoutPage() {
  // If you have auth, pass userId here from your session
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8">
        <WorkoutVoiceCoach />
      </div>
    </main>
  );
}
