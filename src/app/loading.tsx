import LoadingScreen from "@/components/LoadingScreen";

export default function Loading() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <LoadingScreen
        message="Loading workspace..."
        subtext="Synchronizing workflow data and assignments"
        size="lg"
      />
    </div>
  );
}
