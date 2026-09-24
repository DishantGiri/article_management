"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";

export default function ProductCategoriesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/product-types");
  }, [router]);

  return (
    <div className="p-8 min-h-screen bg-[#FAF9F5] flex items-center justify-center">
      <LoadingScreen message="Redirecting to Product Types and Categories..." size="md" />
    </div>
  );
}
