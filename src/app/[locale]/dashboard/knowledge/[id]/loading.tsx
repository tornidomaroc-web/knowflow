import { SubjectSkeleton } from '@/components/skeleton/DashboardSkeletons';

// Item 4j: shown the moment the tap is taken, inside the real chrome, until
// the screen's server render arrives (src/components/skeleton/DashboardSkeletons.tsx).
export default function Loading() {
  return <SubjectSkeleton />;
}
