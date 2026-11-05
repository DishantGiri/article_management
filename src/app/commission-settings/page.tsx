"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Coins,
  DollarSign,
  Percent,
  Save,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Link2,
  PenTool,
  Award,
  Search,
  PartyPopper,
  Info,
  ArrowRight,
  TrendingUp,
  ShoppingBag,
  Pill,
  Layers,
  Plus,
  Minus,
  SlidersHorizontal,
  ArrowUpRight,
  Trash2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import LoadingScreen from "@/components/LoadingScreen";
import ConfirmDialog from "@/components/ConfirmDialog";
import CommissionPasswordGate from "@/components/CommissionPasswordGate";

interface CommissionTier {
  id?: number;
  category: "NUTRA" | "ECOM";
  saleType: "FIRST_SALE" | "RESALE";
  rateType: "FIXED" | "PERCENTAGE";
  currency: string;
  linker: number;
  writer: number;
  tl: number;
  seo: number;
  bonusPool: number;
  partyFund: number;
  total: number;
  notes?: string | null;
  updatedAt?: string;
}

const POOL_CONFIG = [
  {
    key: "linker" as const,
    label: "Linker / Product Researcher",
    roleDesc: "Product research, affiliate sourcing & link integration",
    icon: Link2,
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    barColor: "bg-sky-500",
    border: "border-sky-200 dark:border-sky-800/60",
    accentLight: "hover:border-sky-300 dark:hover:border-sky-700",
  },
  {
    key: "writer" as const,
    label: "Writer",
    roleDesc: "Content authorship & article delivery",
    icon: PenTool,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    barColor: "bg-indigo-500",
    border: "border-indigo-200 dark:border-indigo-800/60",
    accentLight: "hover:border-indigo-300 dark:hover:border-indigo-700",
  },
  {
    key: "tl" as const,
    label: "Team Lead (TL)",
    roleDesc: "Review, QA oversight & approval",
    icon: Award,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    barColor: "bg-amber-500",
    border: "border-amber-200 dark:border-amber-800/60",
    accentLight: "hover:border-amber-300 dark:hover:border-amber-700",
  },
  {
    key: "seo" as const,
    label: "SEO",
    roleDesc: "Search ranking & organic optimization",
    icon: Search,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    barColor: "bg-emerald-500",
    border: "border-emerald-200 dark:border-emerald-800/60",
    accentLight: "hover:border-emerald-300 dark:hover:border-emerald-700",
  },
  {
    key: "bonusPool" as const,
    label: "Bonus Pool",
    roleDesc: "Performance milestone & quarterly pool",
    icon: TrendingUp,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    barColor: "bg-purple-500",
    border: "border-purple-200 dark:border-purple-800/60",
    accentLight: "hover:border-purple-300 dark:hover:border-purple-700",
  },
  {
    key: "partyFund" as const,
    label: "Party Funds",
    roleDesc: "Team celebrations, outings & culture",
    icon: PartyPopper,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    barColor: "bg-rose-500",
    border: "border-rose-200 dark:border-rose-800/60",
    accentLight: "hover:border-rose-300 dark:hover:border-rose-700",
  },
];

export const getCurrencySymbol = (curr?: string) => {
  if (!curr) return "Rs. ";
  const c = curr.toUpperCase();
  if (c === "USD" || c === "$") return "$";
  if (c === "NPR" || c === "RS" || c === "RUPEES") return "Rs. ";
  return `${curr} `;
};

export const getCurrencyShort = (curr?: string) => {
  if (!curr) return "Rs";
  const c = curr.toUpperCase();
  if (c === "USD" || c === "$") return "$";
  return "Rs";
};

export function getPoolPercentages(pools: typeof POOL_CONFIG, tier: CommissionTier): Record<string, string> {
  if (!tier.total || tier.total <= 0) {
    return Object.fromEntries(pools.map((p) => [p.key, "0%"]));
  }

  const raw = pools.map((p) => {
    const val = Number(tier[p.key] || 0);
    return {
      key: p.key,
      val,
      pct: (val / tier.total) * 100,
    };
  });

  const hasFractions = raw.some((r) => Math.abs(r.pct - Math.round(r.pct)) > 0.01);

  if (hasFractions) {
    let sumTenths = 0;
    const roundedTenths = raw.map((r) => {
      const tenths = Math.round(r.pct * 10);
      sumTenths += tenths;
      return { ...r, tenths };
    });

    const diffTenths = 1000 - sumTenths;
    if (diffTenths !== 0) {
      const sorted = [...roundedTenths].sort(
        (a, b) => Math.abs(b.pct * 10 - b.tenths) - Math.abs(a.pct * 10 - a.tenths)
      );
      if (sorted[0]) {
        sorted[0].tenths += diffTenths;
      }
    }

    const formatted: Record<string, string> = {};
    roundedTenths.forEach((r) => {
      const val = r.tenths / 10;
      formatted[r.key] = val % 1 === 0 ? `${val}%` : `${val.toFixed(1)}%`;
    });
    return formatted;
  }

  // Integer mode with Largest Remainder Method
  const floors = raw.map((r) => ({
    key: r.key,
    val: r.val,
    floor: Math.floor(r.pct),
    rem: r.pct - Math.floor(r.pct),
  }));

  const sumFloors = floors.reduce((acc, f) => acc + f.floor, 0);
  const diff = 100 - sumFloors;

  const sorted = [...floors].sort((a, b) => b.rem - a.rem || b.val - a.val);
  const addSet = new Set(sorted.slice(0, Math.max(0, diff)).map((s) => s.key));

  const result: Record<string, string> = {};
  floors.forEach((f) => {
    const finalVal = f.floor + (addSet.has(f.key) ? 1 : 0);
    result[f.key] = `${finalVal}%`;
  });
  return result;
}

function areSettingsEqual(
  a: Record<string, CommissionTier>,
  b: Record<string, CommissionTier>
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length === 0 && keysB.length === 0) return true;
  if (keysA.length === 0 || keysB.length === 0) return false;

  for (const key of keysA) {
    const tierA = a[key];
    const tierB = b[key];
    if (!tierB) return false;

    if (
      tierA.category !== tierB.category ||
      tierA.saleType !== tierB.saleType ||
      tierA.rateType !== tierB.rateType ||
      tierA.currency !== tierB.currency ||
      Number(tierA.linker || 0) !== Number(tierB.linker || 0) ||
      Number(tierA.writer || 0) !== Number(tierB.writer || 0) ||
      Number(tierA.tl || 0) !== Number(tierB.tl || 0) ||
      Number(tierA.seo || 0) !== Number(tierB.seo || 0) ||
      Number(tierA.bonusPool || 0) !== Number(tierB.bonusPool || 0) ||
      Number(tierA.partyFund || 0) !== Number(tierB.partyFund || 0) ||
      Number(tierA.total || 0) !== Number(tierB.total || 0) ||
      (tierA.notes || "") !== (tierB.notes || "")
    ) {
      return false;
    }
  }

  for (const key of keysB) {
    if (!a[key]) return false;
  }

  return true;
}

function CommissionSettingsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Active Category Tab: NUTRA or ECOM
  const [activeCategory, setActiveCategory] = useState<"NUTRA" | "ECOM">("NUTRA");

  // Settings state for all 4 combinations
  const [settings, setSettings] = useState<Record<string, CommissionTier>>({});
  const [initialSettings, setInitialSettings] = useState<Record<string, CommissionTier>>({});

  // Track if changes have been made compared to saved baseline
  const hasChanges = useMemo(() => {
    if (Object.keys(initialSettings).length === 0) return false;
    return !areSettingsEqual(settings, initialSettings);
  }, [settings, initialSettings]);

  // Fetch Settings
  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user?.role !== "SUPER_ADMIN") {
      setLoading(false);
      return;
    }

    fetch("/api/commission-settings")
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}: Failed to load settings`);
        }
        return res.json();
      })
      .then((data: CommissionTier[]) => {
        const mapped: Record<string, CommissionTier> = {};
        if (Array.isArray(data)) {
          data.forEach((tier) => {
            const key = `${tier.category}_${tier.saleType}`;
            mapped[key] = tier;
          });
        }
        setSettings(mapped);
        setInitialSettings(JSON.parse(JSON.stringify(mapped)));
      })
      .catch((err: any) => {
        console.error(err);
        toast.error(err.message || "Failed to load commission settings");
      })
      .finally(() => {
        setLoading(false);
        setHasLoadedInitial(true);
      });
  }, [session, status]);

  // Update a single field in a tier
  const handleFieldChange = (
    category: "NUTRA" | "ECOM",
    saleType: "FIRST_SALE" | "RESALE",
    field: keyof CommissionTier,
    value: any
  ) => {
    const key = `${category}_${saleType}`;
    setSettings((prev) => {
      const current = prev[key] || {
        category,
        saleType,
        rateType: "FIXED",
        currency: "NPR",
        linker: 0,
        writer: 0,
        tl: 0,
        seo: 0,
        bonusPool: 0,
        partyFund: 0,
        total: 0,
        notes: "",
      };

      const updated = { ...current, [field]: value };

      // Recalculate total if any pool field changed
      if (
        ["linker", "writer", "tl", "seo", "bonusPool", "partyFund"].includes(
          field as string
        )
      ) {
        const sum =
          Number(updated.linker || 0) +
          Number(updated.writer || 0) +
          Number(updated.tl || 0) +
          Number(updated.seo || 0) +
          Number(updated.bonusPool || 0) +
          Number(updated.partyFund || 0);
        updated.total = parseFloat(sum.toFixed(2));
      }

      return {
        ...prev,
        [key]: updated,
      };
    });
  };


  // Save All Changes
  const handleSaveAll = async () => {
    if (!hasChanges) {
      toast("No changes to save", {
        icon: "ℹ️",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = Object.values(settings);
      const res = await fetch("/api/commission-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Save failed");
      }

      setInitialSettings(JSON.parse(JSON.stringify(settings)));
      toast.success("All commission settings saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Open Custom Confirmation Popup for Resetting
  const handleOpenResetConfirm = () => {
    setShowResetConfirm(true);
  };

  // Reset to Defaults (Triggered by Custom Popup)
  const handleExecuteReset = async () => {
    setShowResetConfirm(false);
    setResetting(true);
    try {
      const res = await fetch("/api/commission-settings/reset", {
        method: "POST",
      });

      if (!res.ok) throw new Error("Reset failed");

      const data = await res.json();
      const mapped: Record<string, CommissionTier> = {};
      (data.data as CommissionTier[]).forEach((tier) => {
        const key = `${tier.category}_${tier.saleType}`;
        mapped[key] = tier;
      });
      setSettings(mapped);
      setInitialSettings(JSON.parse(JSON.stringify(mapped)));

      toast.success("Commission settings reset to standard defaults!");
    } catch (err: any) {
      toast.error(err.message || "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  if (!hasLoadedInitial && (loading || status === "loading")) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950">
        <LoadingScreen
          message="Loading commission settings..."
          subtext="Retrieving Nutra and E-Commerce commission configurations"
          size="lg"
        />
      </div>
    );
  }

  // Super Admin Role Verification
  if (!session || session.user?.role !== "SUPER_ADMIN") {
    return (
      <div className="p-6 sm:p-12 max-w-2xl mx-auto min-h-screen flex flex-col items-center justify-center text-center bg-[#FAF9F5] dark:bg-slate-950 text-[#4A4A4A] dark:text-slate-100">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-5 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#4A4A4A] dark:text-white">
          Super Admin Access Required
        </h1>
        <p className="text-sm text-[#737373] dark:text-slate-400 mt-2 max-w-md font-medium leading-relaxed">
          Commission configuration settings are strictly restricted to the Super
          Administrator role. Please sign in with an authorized account to
          manage commission parameters.
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 px-5 py-2.5 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white text-xs font-bold transition shadow-xs cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const getTier = (category: "NUTRA" | "ECOM", saleType: "FIRST_SALE" | "RESALE"): CommissionTier => {
    const key = `${category}_${saleType}`;
    return (
      settings[key] || {
        category,
        saleType,
        rateType: "FIXED",
        currency: "NPR",
        linker: 0,
        writer: 0,
        tl: 0,
        seo: 0,
        bonusPool: 0,
        partyFund: 0,
        total: 0,
        notes: "",
      }
    );
  };

  const nutraFirst = getTier("NUTRA", "FIRST_SALE");
  const nutraResale = getTier("NUTRA", "RESALE");
  const ecomFirst = getTier("ECOM", "FIRST_SALE");
  const ecomResale = getTier("ECOM", "RESALE");

  const activeFirstSale = activeCategory === "NUTRA" ? nutraFirst : ecomFirst;
  const activeResale = activeCategory === "NUTRA" ? nutraResale : ecomResale;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#FAF9F5] dark:bg-slate-950 text-[#4A4A4A] dark:text-slate-100 space-y-6">
      {/* ─── HEADER BANNER ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-100/40 dark:from-indigo-950/20 via-sky-100/20 dark:via-sky-950/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#6D8196] via-[#5A6D81] to-[#3D4F61] text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <Coins className="w-8 h-8 drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#4A4A4A] dark:text-white">
                  Commission Settings
                </h1>
                <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 flex items-center gap-1.5 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  Super Admin Exclusive
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#737373] dark:text-slate-400 mt-1 font-medium max-w-2xl leading-relaxed">
                Configure commission distribution across Nutra and E-Commerce verticals
                for 1st Sales and Resales across Linker, Writer, Team Lead, SEO, Bonus Pool, and Party Funds.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={handleOpenResetConfirm}
              disabled={resetting || saving}
              className="px-4 py-2.5 rounded-xl border border-[#CBCBCB]/80 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 text-xs font-bold text-[#4A4A4A] dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 transition flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resetting ? "animate-spin" : ""}`} />
              <span>Reset Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || resetting || !hasChanges}
              className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
                !hasChanges || saving || resetting
                  ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-transparent shadow-none"
                  : "bg-[#6D8196] hover:bg-[#5A6D81] text-white cursor-pointer shadow-xs active:scale-95"
              }`}
              title={!hasChanges ? "No changes to save" : "Save All Settings"}
            >
              <Save className={`w-4 h-4 ${saving ? "animate-spin" : ""}`} />
              <span>{saving ? "Saving Changes..." : "Save All Settings"}</span>
            </button>
          </div>
        </div>

        {/* Quick Vertical Overview Metric Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#CBCBCB]/40 dark:border-slate-800">
          <div className="p-3 rounded-2xl bg-[#FAF9F5] dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Nutra 1st Sale</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {nutraFirst.rateType === "FIXED" ? `${getCurrencySymbol(nutraFirst.currency)}${nutraFirst.total.toFixed(2)}` : `${nutraFirst.total}%`}
              </span>
            </div>
            <Pill className="w-4 h-4 text-emerald-500 opacity-60" />
          </div>

          <div className="p-3 rounded-2xl bg-[#FAF9F5] dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Nutra Resale</span>
              <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                {nutraResale.rateType === "FIXED" ? `${getCurrencySymbol(nutraResale.currency)}${nutraResale.total.toFixed(2)}` : `${nutraResale.total.toFixed(2)}%`}
              </span>
            </div>
            <Pill className="w-4 h-4 text-blue-500 opacity-60" />
          </div>

          <div className="p-3 rounded-2xl bg-[#FAF9F5] dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Ecom 1st Sale</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {ecomFirst.rateType === "FIXED" ? `${getCurrencySymbol(ecomFirst.currency)}${ecomFirst.total.toFixed(2)}` : `${ecomFirst.total.toFixed(2)}%`}
              </span>
            </div>
            <ShoppingBag className="w-4 h-4 text-emerald-500 opacity-60" />
          </div>

          <div className="p-3 rounded-2xl bg-[#FAF9F5] dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Ecom Resale</span>
              <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                {ecomResale.rateType === "FIXED" ? `${getCurrencySymbol(ecomResale.currency)}${ecomResale.total.toFixed(2)}` : `${ecomResale.total.toFixed(2)}%`}
              </span>
            </div>
            <ShoppingBag className="w-4 h-4 text-blue-500 opacity-60" />
          </div>
        </div>

        {/* ─── VERTICAL TABS SELECTOR ─────────────────────────────────── */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#CBCBCB]/40 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveCategory("NUTRA")}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${activeCategory === "NUTRA"
                ? "bg-[#6D8196] text-white shadow-2xs"
                : "bg-[#FAF9F5] dark:bg-slate-800/80 text-[#737373] dark:text-slate-300 hover:text-[#4A4A4A] dark:hover:text-white border border-[#CBCBCB]/60 dark:border-slate-700"
              }`}
          >
            <Pill className="w-4 h-4" />
            <span>Nutra Commissions</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${activeCategory === "NUTRA"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
            >
              1st: {nutraFirst.rateType === "FIXED" ? `${getCurrencySymbol(nutraFirst.currency)}${nutraFirst.total.toFixed(2)}` : `${nutraFirst.total.toFixed(2)}%`} | Resale: {nutraResale.rateType === "FIXED" ? `${getCurrencySymbol(nutraResale.currency)}${nutraResale.total.toFixed(2)}` : `${nutraResale.total.toFixed(2)}%`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("ECOM")}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${activeCategory === "ECOM"
                ? "bg-[#6D8196] text-white shadow-2xs"
                : "bg-[#FAF9F5] dark:bg-slate-800/80 text-[#737373] dark:text-slate-300 hover:text-[#4A4A4A] dark:hover:text-white border border-[#CBCBCB]/60 dark:border-slate-700"
              }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Ecom Commissions</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${activeCategory === "ECOM"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
            >
              1st: {ecomFirst.rateType === "FIXED" ? `${getCurrencySymbol(ecomFirst.currency)}${ecomFirst.total.toFixed(2)}` : `${ecomFirst.total.toFixed(2)}%`} | Resale: {ecomResale.rateType === "FIXED" ? `${getCurrencySymbol(ecomResale.currency)}${ecomResale.total.toFixed(2)}` : `${ecomResale.total.toFixed(2)}%`}
            </span>
          </button>
        </div>
      </div>

      {/* ─── MAIN 2-COLUMN GRID (1st Sale & Resale) ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: 1st SALE */}
        <CommissionCard
          title={`${activeCategory === "NUTRA" ? "Nutra" : "Ecom"} - 1st Sale`}
          subtitle="Commission distribution for new customer acquisitions & initial conversions"
          tier={activeFirstSale}
          badge="1st Sale"
          badgeColor="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50"
          onChangeField={(field, val) =>
            handleFieldChange(activeCategory, "FIRST_SALE", field, val)
          }
        />

        {/* CARD 2: RESALE */}
        <CommissionCard
          title={`${activeCategory === "NUTRA" ? "Nutra" : "Ecom"} - Resale`}
          subtitle="Commission distribution for repeat purchases & recurring customer renewals"
          tier={activeResale}
          badge="Resale / Recurring"
          badgeColor="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50"
          onChangeField={(field, val) =>
            handleFieldChange(activeCategory, "RESALE", field, val)
          }
        />
      </div>

      {/* Custom Confirmation Dialog for Resetting Defaults */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset Commission Defaults"
        message="Are you sure you want to reset all commission allocations back to standard defaults? Any unsaved changes will be lost."
        confirmLabel="Reset Defaults"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={handleExecuteReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}

export default function CommissionSettingsPage() {
  return (
    <CommissionPasswordGate pageTitle="Commission Settings">
      <CommissionSettingsContent />
    </CommissionPasswordGate>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// REUSABLE COMMISSION TIER CONFIG CARD
// ─────────────────────────────────────────────────────────────────────────

interface CommissionCardProps {
  title: string;
  subtitle: string;
  tier: CommissionTier;
  badge: string;
  badgeColor: string;
  onChangeField: (field: keyof CommissionTier, value: any) => void;
}

function CommissionCard({
  title,
  subtitle,
  tier,
  badge,
  badgeColor,
  onChangeField,
}: CommissionCardProps) {
  const isFixed = tier.rateType === "FIXED";
  const currencySymbol = getCurrencySymbol(tier.currency);
  const currencyShort = getCurrencyShort(tier.currency);
  const unitSymbol = isFixed ? currencySymbol : "%";

  return (
    <div className="bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-6 relative overflow-hidden">
      <div className="space-y-5">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#CBCBCB]/40 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-[#4A4A4A] dark:text-white">
                {title}
              </h3>
              <span
                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-2xs ${badgeColor}`}
              >
                {badge}
              </span>
            </div>
            <p className="text-xs text-[#737373] dark:text-slate-400 mt-1 font-medium">
              {subtitle}
            </p>
          </div>

          {/* Rate Type & Currency Switchers */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
            {/* Currency Selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => onChangeField("currency", "NPR")}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  tier.currency === "NPR" || !tier.currency
                    ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs font-extrabold"
                    : "text-[#737373] dark:text-slate-400 hover:text-[#4A4A4A]"
                }`}
                title="Nepalese Rupee (Rs)"
              >
                NPR (Rs)
              </button>
              <button
                type="button"
                onClick={() => onChangeField("currency", "USD")}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  tier.currency === "USD"
                    ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs font-extrabold"
                    : "text-[#737373] dark:text-slate-400 hover:text-[#4A4A4A]"
                }`}
                title="US Dollar ($)"
              >
                USD ($)
              </button>
            </div>

            {/* Rate Type Switcher: Fixed vs Percentage */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => onChangeField("rateType", "FIXED")}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  isFixed
                    ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs font-extrabold"
                    : "text-[#737373] dark:text-slate-400 hover:text-[#4A4A4A]"
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Fixed ({currencyShort})</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeField("rateType", "PERCENTAGE")}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  !isFixed
                    ? "bg-white dark:bg-slate-700 text-[#4A4A4A] dark:text-white shadow-2xs font-extrabold"
                    : "text-[#737373] dark:text-slate-400 hover:text-[#4A4A4A]"
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Percentage</span>
              </button>
            </div>
          </div>
        </div>

        {/* Visual Allocation Proportion Bar */}
        <div className="p-3.5 rounded-2xl bg-[#FAF9F5] dark:bg-slate-850/80 border border-slate-200 dark:border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#737373] dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#6D8196]" />
              <span>Combined Pool Allocation</span>
            </span>
            <span className="text-sm font-black text-[#4A4A4A] dark:text-white">
              Total: {isFixed ? `${currencySymbol}${tier.total.toFixed(2)}` : `${tier.total.toFixed(2)}%`}
            </span>
          </div>

          <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
            {POOL_CONFIG.map((pool) => {
              const val = tier[pool.key] || 0;
              const widthPct = tier.total > 0 ? (val / tier.total) * 100 : 0;
              if (widthPct <= 0) return null;
              return (
                <div
                  key={pool.key}
                  className={`${pool.barColor} h-full transition-all duration-300`}
                  style={{ width: `${widthPct}%` }}
                  title={`${pool.label}: ${unitSymbol}${val} (${widthPct.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          {/* Mini Legend Row */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            {(() => {
              const percentages = getPoolPercentages(POOL_CONFIG, tier);
              return POOL_CONFIG.map((pool) => (
                <div key={pool.key} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${pool.barColor}`} />
                  <span>{pool.label}:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{percentages[pool.key]}</span>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* 6 Pool Input Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {POOL_CONFIG.map((pool) => {
            const val = tier[pool.key] ?? 0;
            const pctShare =
              tier.total > 0 ? ((val / tier.total) * 100).toFixed(1) : "0.0";

            return (
              <PoolInputCard
                key={pool.key}
                pool={pool}
                val={val}
                unitSymbol={unitSymbol}
                isFixed={isFixed}
                pctShare={pctShare}
                onUpdate={(newVal) => onChangeField(pool.key, newVal)}
              />
            );
          })}
        </div>

        {/* Notes / Strategy Box */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#737373] dark:text-slate-400 mb-1.5">
            Internal Strategy Notes / Remarks
          </label>
          <textarea
            rows={2}
            value={tier.notes || ""}
            onChange={(e) => onChangeField("notes", e.target.value)}
            placeholder="Enter commission policy rules or tier notes..."
            className="w-full px-3 py-2 rounded-xl text-xs bg-[#FAF9F5] dark:bg-slate-850 border border-[#CBCBCB]/70 dark:border-slate-800 text-[#4A4A4A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6D8196]/40 transition"
          />
        </div>
      </div>

      {/* Card Footer Summary */}
      <div className="pt-4 border-t border-[#CBCBCB]/40 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="text-[#737373] dark:text-slate-400 font-medium">
          Total Combined Allocation:
        </span>
        <span className="text-lg font-black text-[#6D8196] dark:text-sky-400 tracking-tight">
          {isFixed ? `${currencySymbol}${tier.total.toFixed(2)}` : `${tier.total.toFixed(2)}%`}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// REFINED INDIVIDUAL POOL INPUT CARD
// ─────────────────────────────────────────────────────────────────────────

function PoolInputCard({
  pool,
  val,
  unitSymbol,
  isFixed,
  pctShare,
  onUpdate,
}: {
  pool: typeof POOL_CONFIG[number];
  val: number;
  unitSymbol: string;
  isFixed: boolean;
  pctShare: string;
  onUpdate: (newVal: number) => void;
}) {
  const step = isFixed ? 0.5 : 1;
  const [inputValue, setInputValue] = useState<string>(val === 0 ? "0" : String(val));

  useEffect(() => {
    setInputValue((prev) => {
      const parsed = parseFloat(prev);
      if (!isNaN(parsed) && parsed === val) {
        return prev;
      }
      return val === 0 ? "0" : String(val);
    });
  }, [val]);

  const handleStep = (delta: number) => {
    const nextVal = Math.max(0, parseFloat((val + delta).toFixed(2)));
    setInputValue(nextVal === 0 ? "0" : String(nextVal));
    onUpdate(nextVal);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // Allow only digits and at most one decimal point
    raw = raw.replace(/[^0-9.]/g, "");
    const parts = raw.split(".");
    if (parts.length > 2) {
      raw = parts[0] + "." + parts.slice(1).join("");
    }

    // Auto prepend 0 if user enters starting with a decimal point like ".5"
    if (raw.startsWith(".")) {
      raw = "0" + raw;
    }

    // Strip leading zeros before a non-zero digit: e.g. "06" -> "6", "06456" -> "6456"
    if (/^0+[1-9]/.test(raw)) {
      raw = raw.replace(/^0+/, "");
    } else if (/^0{2,}$/.test(raw)) {
      // Multiple zeros like "00" becomes "0"
      raw = "0";
    }

    setInputValue(raw);
    const parsed = parseFloat(raw);
    onUpdate(isNaN(parsed) ? 0 : Math.max(0, parsed));
  };

  const handleBlur = () => {
    if (!inputValue || isNaN(parseFloat(inputValue))) {
      setInputValue("0");
      onUpdate(0);
    } else {
      const parsed = parseFloat(inputValue);
      setInputValue(parsed === 0 ? "0" : String(parsed));
    }
  };

  return (
    <div
      className={`group relative p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-850/90 ${pool.border} ${pool.accentLight} hover:shadow-md flex flex-col justify-between space-y-3`}
    >
      {/* Card Header: Icon, Name & Share Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${pool.bg} ${pool.color}`}
          >
            <pool.icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
              {pool.label}
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {pool.roleDesc}
            </p>
          </div>
        </div>

        {/* Share Pill */}
        <div
          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 shadow-2xs ${pool.bg} ${pool.color} ${pool.border}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${pool.barColor}`} />
          <span>{pctShare}%</span>
        </div>
      </div>

      {/* Center: Tactile Stepper & Amount Input */}
      <div className="bg-[#FAF9F5] dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1 flex items-center justify-between gap-1 shadow-inner focus-within:ring-2 focus-within:ring-[#6D8196]/40 focus-within:border-[#6D8196] transition-all">
        {/* Decrement Button */}
        <button
          type="button"
          onClick={() => handleStep(-step)}
          disabled={val <= 0}
          className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-25 disabled:hover:bg-transparent text-slate-600 dark:text-slate-200 flex items-center justify-center font-black text-sm transition-transform active:scale-90 shadow-2xs cursor-pointer"
          title={`Decrease by ${step}`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Value Display with Currency Symbol (prefix for currency, suffix for percentage) */}
        <div className="flex-1 flex items-center justify-center gap-1.5 px-2">
          {isFixed && (
            <span className="text-xs font-black text-slate-400 dark:text-slate-500 select-none">
              {unitSymbol.trim()}
            </span>
          )}
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={inputValue}
            onFocus={(e) => e.target.select()}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full text-center bg-transparent text-base sm:text-lg font-black text-slate-900 dark:text-white focus:outline-none tracking-tight"
          />
          {!isFixed && (
            <span className="text-xs font-black text-slate-400 dark:text-slate-500 select-none">
              %
            </span>
          )}
        </div>

        {/* Increment Button */}
        <button
          type="button"
          onClick={() => handleStep(step)}
          className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 flex items-center justify-center font-black text-sm transition-transform active:scale-90 shadow-2xs cursor-pointer"
          title={`Increase by ${step}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
