import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-end pb-12 animate-fade-in">
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/404.svg"
          alt="404 Not Found Animation"
          fill
          className="object-fit"
          priority
        />
      </div>
      
      <Link 
        href="/"
        className="relative z-10 px-10 py-4 bg-slate-900 text-white text-lg rounded-xl font-bold hover:bg-black shadow-xl shadow-slate-900/20 transition-all hover:-translate-y-1 active:translate-y-0"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
