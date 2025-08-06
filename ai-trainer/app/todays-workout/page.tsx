// /app/todays-workout/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import TodaysWorkoutClient from './TodaysWorkoutClient';

export default function TodaysWorkoutPage() {
  return <TodaysWorkoutClient />;
} 