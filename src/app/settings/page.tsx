/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  User,
  Mail,
  Bell,
  Volume2,
  VolumeX,
  Volume1,
  Shield,
  Sliders,
  Sparkles,
  CheckCircle2,
  Save,
  RefreshCw,
  Play,
  Lock,
  Monitor,
  Globe,
  Radio,
  FileText,
  Link2,
  Package,
  LogOut,
  Info,
} from "lucide-react";
import { toast } from "react-hot-toast";
import CustomSelect from "@/components/CustomSelect";
import LoadingScreen from "@/components/LoadingScreen";

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-800 border-purple-200",
  ADMIN: "bg-indigo-100 text-indigo-800 border-indigo-200",
  TEAM_LEAD: "bg-sky-100 text-sky-800 border-sky-200",
  LINKER: "bg-emerald-100 text-emerald-800 border-emerald-200",
  WRITER: "bg-amber-100 text-amber-800 border-amber-200",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  SUPER_ADMIN: "Complete unrestricted access across user administration, site configurations, and all workflows.",
  ADMIN: "Full system administration, product pipeline oversight, user assignments, and team management.",
  TEAM_LEAD: "Supervises assigned writers, reviews articles, provides feedback, and oversees quality workflows.",
  LINKER: "Manages bridge pages, product links, affiliate verification, and link operations.",
  WRITER: "Authors original content, addresses reviewer feedback, and manages assigned articles.",
};

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"profile" | "notifications" | "workspace" | "security">("profile");

  // User Profile
  const [userData, setUserData] = useState<any>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Notification Preferences
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(80); // 0 - 100
  const [toastEnabled, setToastEnabled] = useState(true);
  const [desktopEnabled, setDesktopEnabled] = useState(false);
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission>("default");
  const [notifArticleStatus, setNotifArticleStatus] = useState(true);
  const [notifLinkIssues, setNotifLinkIssues] = useState(true);
  const [notifProductAdded, setNotifProductAdded] = useState(true);
  const [notifAnnouncements, setNotifAnnouncements] = useState(true);

  // Workspace Preferences
  const [defaultLandingPage, setDefaultLandingPage] = useState("/");
  const [tableDensity, setTableDensity] = useState<"cozy" | "compact">("cozy");
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<string>("30");

  // Testing sound audio object
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  // Load preferences from localStorage and database
  useEffect(() => {
    if (typeof window !== "undefined") {
      setSoundEnabled(localStorage.getItem("notif_sound_enabled") !== "false");
      const vol = localStorage.getItem("notif_sound_volume");
      if (vol !== null) {
        setSoundVolume(Math.round(parseFloat(vol) * 100));
      }
      setToastEnabled(localStorage.getItem("notif_toast_enabled") !== "false");
      setDesktopEnabled(localStorage.getItem("notif_desktop_enabled") === "true");
      setNotifArticleStatus(localStorage.getItem("notif_sub_articles") !== "false");
      setNotifLinkIssues(localStorage.getItem("notif_sub_links") !== "false");
      setNotifProductAdded(localStorage.getItem("notif_sub_products") !== "false");
      setNotifAnnouncements(localStorage.getItem("notif_sub_broadcasts") !== "false");

      setDefaultLandingPage(localStorage.getItem("pref_default_landing") || "/");
      setTableDensity((localStorage.getItem("pref_table_density") as any) || "cozy");
      setAutoRefreshInterval(localStorage.getItem("pref_auto_refresh") || "30");

      if ("Notification" in window) {
        setDesktopPermission(Notification.permission);
      }
    }
  }, []);

  // Fetch current user data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user?.id) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/users/${session.user.id}`);
        if (res.ok) {
          const user = await res.json();
          setUserData(user);
          setName(user.name || session.user.name || "");
          setEmail(user.email || session.user.email || "");
          setImageUrl(user.image || "");
        } else if (session.user) {
          setName(session.user.name || "");
          setEmail(session.user.email || "");
        }
      } catch (err) {
        console.error("Failed to load user profile", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [session?.user?.id]);

  // Handle Profile Save
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!session?.user?.id) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/users/${session.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          image: imageUrl.trim() || null,
        }),
      });

      if (res.ok) {
        toast.success("Profile changes saved successfully!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update profile.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Notification Settings Save
  const handleSaveNotifications = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("notif_sound_enabled", soundEnabled ? "true" : "false");
      localStorage.setItem("notif_sound_volume", (soundVolume / 100).toFixed(2));
      localStorage.setItem("notif_toast_enabled", toastEnabled ? "true" : "false");
      localStorage.setItem("notif_desktop_enabled", desktopEnabled ? "true" : "false");
      localStorage.setItem("notif_sub_articles", notifArticleStatus ? "true" : "false");
      localStorage.setItem("notif_sub_links", notifLinkIssues ? "true" : "false");
      localStorage.setItem("notif_sub_products", notifProductAdded ? "true" : "false");
      localStorage.setItem("notif_sub_broadcasts", notifAnnouncements ? "true" : "false");
    }
    toast.success("Notification preferences saved!");
  };

  // Handle Workspace Preferences Save
  const handleSaveWorkspace = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pref_default_landing", defaultLandingPage);
      localStorage.setItem("pref_table_density", tableDensity);
      localStorage.setItem("pref_auto_refresh", autoRefreshInterval);
    }
    toast.success("Workspace preferences updated!");
  };

  // Play Test Notification Sound
  const playTestSound = () => {
    if (!soundEnabled) {
      toast.error("Sound alerts are currently disabled. Toggle them on to test sound.");
      return;
    }
    setIsPlayingTestSound(true);
    try {
      const audio = new Audio("/mixkit-software-interface-back-2575.wav");
      audio.volume = Math.max(0, Math.min(1, soundVolume / 100));
      audio.currentTime = 0;
      audio
        .play()
        .then(() => {
          setTimeout(() => setIsPlayingTestSound(false), 800);
        })
        .catch((e) => {
          console.warn("Test audio play blocked:", e);
          setIsPlayingTestSound(false);
        });
    } catch (err) {
      setIsPlayingTestSound(false);
    }
  };

  // Trigger Demo Toast
  const triggerDemoToast = () => {
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? "animate-enter" : "animate-leave"
        } max-w-md w-full bg-white shadow-lg rounded-2xl pointer-events-auto flex ring-1 ring-black/5 p-4 border border-[#CBCBCB]/60`}
      >
        <div className="flex-1 w-0 flex items-center">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-xs font-bold text-[#4A4A4A]">Live Notification Sample</p>
            <p className="mt-0.5 text-xs text-[#737373] truncate">
              New article assigned for TBR Supplement 1 by Sujata
            </p>
          </div>
        </div>
        <div className="flex border-l border-gray-200 pl-3 ml-3">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="text-xs font-bold text-[#6D8196] hover:text-[#5A6D81] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    ));
  };

  // Request Desktop Notification Permission
  const requestDesktopPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("Desktop notifications are not supported by this browser.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setDesktopPermission(permission);
      if (permission === "granted") {
        setDesktopEnabled(true);
        localStorage.setItem("notif_desktop_enabled", "true");
        new Notification("Notifications Enabled!", {
          body: "You will now receive desktop alerts for important work events.",
          icon: "/favicon.ico",
        });
        toast.success("Desktop notifications enabled!");
      } else {
        setDesktopEnabled(false);
        localStorage.setItem("notif_desktop_enabled", "false");
        toast.error("Notification permission was denied in your browser.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  const role = userData?.role || session?.user?.role || "WRITER";
  const userInitials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "U";

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-[1400px] mx-auto min-h-screen bg-[#FAF9F5] text-[#4A4A4A]" suppressHydrationWarning>
      {/* ─── TOP HERO BANNER ────────────────────────────────────────── */}
      <div className="bg-white border border-[#CBCBCB]/70 rounded-3xl p-5 sm:p-7 shadow-xs mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-indigo-50/60 via-sky-50/30 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#6D8196]/20 to-[#6D8196]/5 border-2 border-white shadow-sm flex items-center justify-center text-xl sm:text-2xl font-black text-[#4A4A4A] overflow-hidden">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span>{userInitials}</span>
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-xs" title="Online" />
            </div>

            {/* User Meta */}
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#4A4A4A] tracking-tight truncate">{name || "User"}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border uppercase tracking-wider ${ROLE_COLORS[role] || "bg-slate-100 text-slate-700"}`}>
                  {role.replace("_", " ")}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Active Account
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#737373] font-medium flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 shrink-0 text-[#6D8196]" />
                <span>{email || "No email"}</span>
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
            <button
              onClick={() => {
                if (activeTab === "profile") handleSaveProfile();
                else if (activeTab === "notifications") handleSaveNotifications();
                else if (activeTab === "workspace") handleSaveWorkspace();
                else toast.success("Settings up to date!");
              }}
              disabled={saving}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#6D8196] hover:bg-[#5A6D81] disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? "Saving..." : "Save Preferences"}</span>
            </button>
          </div>
        </div>

        {/* ─── TAB NAVIGATION ────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-[#CBCBCB]/40 overflow-x-auto no-scrollbar">
          {[
            { id: "profile", label: "Profile & Identity", icon: User },
            { id: "notifications", label: "Notification Alerts", icon: Bell, badge: soundEnabled ? "Active" : "Muted" },
            { id: "workspace", label: "Workspace & Display", icon: Sliders },
            { id: "security", label: "Security & Session", icon: Shield },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-[#6D8196] text-white shadow-2xs"
                    : "bg-[#FAF9F5] text-[#737373] hover:text-[#4A4A4A] border border-[#CBCBCB]/60 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t.label}</span>
                {t.badge && (
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md uppercase ${
                      isActive ? "bg-white/20 text-white" : "bg-[#6D8196]/10 text-[#6D8196]"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── TAB 1: PROFILE & IDENTITY ─────────────────────────────────── */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Main Profile Form */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-[#CBCBCB]/70 p-5 sm:p-7 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-[#4A4A4A]">Personal Information</h2>
              <p className="text-xs text-[#737373] font-medium mt-0.5">
                Update your display name and personalize your public profile avatar
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#CBCBCB] rounded-xl text-sm font-semibold text-[#4A4A4A] focus:outline-none focus:border-[#6D8196] focus:ring-2 focus:ring-[#6D8196]/20 transition shadow-2xs"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              {/* Email Address (Read-Only) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider">
                    Email Address
                  </label>
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Google OAuth Verified
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    readOnly
                    disabled
                    className="w-full px-4 py-2.5 bg-[#FAF9F5] border border-[#CBCBCB] rounded-xl text-sm font-semibold text-slate-500 focus:outline-none cursor-not-allowed"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Managed via OAuth authentication. To change your primary email, contact system administration.
                </p>
              </div>

              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider mb-2">
                  Choose Profile Avatar
                </label>
                <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {PRESET_AVATARS.map((avatar, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setImageUrl(avatar)}
                      className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition shrink-0 cursor-pointer ${
                        imageUrl === avatar ? "border-[#6D8196] ring-2 ring-[#6D8196]/30 scale-105" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatar} alt="Preset avatar" className="w-full h-full object-cover" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className={`px-3 h-12 rounded-xl border-2 text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      !imageUrl ? "border-[#6D8196] bg-[#6D8196]/10 text-[#3D4F61]" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    Initials Avatar
                  </button>
                </div>
                <div className="mt-3">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Or paste custom image URL (https://...)"
                    className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-[#CBCBCB] bg-[#FAF9F5] text-[#4A4A4A] focus:outline-none focus:bg-white focus:border-[#6D8196]"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3 border-t border-[#CBCBCB]/40 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#6D8196] hover:bg-[#5A6D81] disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Sidebar: Role & Permissions Card */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-[#CBCBCB]/70 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#4A4A4A]">Role & Permissions</h3>
                  <p className="text-[11px] text-[#737373]">Assigned security privileges</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#CBCBCB]/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#4A4A4A]">Current Role</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${ROLE_COLORS[role] || "bg-slate-100"}`}>
                    {role.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-[#737373] leading-relaxed font-medium">
                  {ROLE_DESCRIPTIONS[role] || "Standard operational permissions."}
                </p>
              </div>

              {/* Site Access (If Writer or TL) */}
              {userData?.siteAccess && userData.siteAccess.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-[#4A4A4A] block">Assigned Web Domains:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {userData.siteAccess.map((sa: any) => (
                      <span
                        key={sa.site.id}
                        className="px-2.5 py-1 text-xs font-semibold bg-white border border-[#CBCBCB] text-[#4A4A4A] rounded-lg shadow-2xs flex items-center gap-1"
                      >
                        <Globe className="w-3 h-3 text-[#6D8196]" />
                        {sa.site.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Account Metadata Card */}
            <div className="bg-white rounded-3xl border border-[#CBCBCB]/70 p-5 sm:p-6 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-[#737373] uppercase tracking-wider">Account Information</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">User ID</span>
                  <span className="font-bold text-slate-800">#{session?.user?.id || 1}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Account Status</span>
                  <span className="font-bold text-emerald-600">Active / Approved</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-medium">System Environment</span>
                  <span className="font-bold text-slate-800">Production v1.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: NOTIFICATION CENTER (REQUESTED FEATURE) ─────────────── */}
      {activeTab === "notifications" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Audio Chime & Volume Controls */}
          <div className="bg-white rounded-3xl border border-[#CBCBCB]/70 p-5 sm:p-7 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#CBCBCB]/40">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#4A4A4A]">Sound Alerts & Audio Chimes</h2>
                  <p className="text-xs text-[#737373] font-medium mt-0.5">
                    Play a sound notification whenever you receive article feedback, link updates, or task assignments
                  </p>
                </div>
              </div>

              {/* Master Sound Toggle */}
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="text-xs font-extrabold uppercase text-[#737373]">
                  {soundEnabled ? "Sound ON" : "Sound OFF"}
                </span>
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    soundEnabled ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  role="switch"
                  aria-checked={soundEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      soundEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Volume Slider & Test Button */}
            {soundEnabled && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF9F5] border border-[#CBCBCB]/60 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {soundVolume === 0 ? (
                        <VolumeX className="w-4 h-4 text-slate-400" />
                      ) : soundVolume < 50 ? (
                        <Volume1 className="w-4 h-4 text-[#6D8196]" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-[#6D8196]" />
                      )}
                      <span className="text-xs font-bold text-[#4A4A4A]">Alert Chime Volume: {soundVolume}%</span>
                    </div>
                    <p className="text-[11px] text-[#737373]">
                      Adjust how loud the audio notification rings on this workstation
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={playTestSound}
                    disabled={isPlayingTestSound}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#CBCBCB] hover:border-[#6D8196] text-xs font-bold text-[#4A4A4A] shadow-2xs transition hover:bg-slate-50 cursor-pointer shrink-0"
                  >
                    <Play className={`w-3.5 h-3.5 text-[#6D8196] ${isPlayingTestSound ? "animate-spin" : ""}`} />
                    <span>{isPlayingTestSound ? "Playing..." : "Test Audio Chime"}</span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <VolumeX className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={soundVolume}
                    onChange={(e) => setSoundVolume(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#6D8196]"
                  />
                  <Volume2 className="w-4 h-4 text-slate-600 shrink-0" />
                </div>
              </div>
            )}
          </div>

          {/* Screen Toast Popups & Desktop Alerts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Live Toast Card */}
            <div className="bg-white rounded-3xl border border-[#CBCBCB]/70 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Radio className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-[#4A4A4A]">Live Toast Banners</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setToastEnabled(!toastEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      toastEnabled ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        toastEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-[#737373] leading-relaxed">
                  Displays interactive real-time floating banners in the upper corner when active tasks or decisions update.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">
                  {toastEnabled ? "Toasts Enabled" : "Toasts Disabled"}
                </span>
                <button
                  type="button"
                  onClick={triggerDemoToast}
                  className="px-3 py-1.5 bg-[#FAF9F5] hover:bg-slate-100 border border-[#CBCBCB]/60 text-[#4A4A4A] rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Preview Toast Banner
                </button>
              </div>
            </div>

            {/* Desktop Push Alerts Card */}
            <div className="bg-white rounded-3xl border border-[#CBCBCB]/70 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                      <Monitor className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-[#4A4A4A]">Desktop Push Alerts</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!desktopEnabled && desktopPermission !== "granted") {
                        requestDesktopPermission();
                      } else {
                        setDesktopEnabled(!desktopEnabled);
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      desktopEnabled ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        desktopEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-[#737373] leading-relaxed">
                  Receive native OS alerts even if your browser tab is minimized or running in the background.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                    desktopPermission === "granted"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  Permission: {desktopPermission}
                </span>

                {desktopPermission !== "granted" && (
                  <button
                    type="button"
                    onClick={requestDesktopPermission}
                    className="px-3 py-1.5 bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Grant Access
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Granular Activity Subscriptions */}
          <div className="bg-white rounded-3xl border border-[#CBCBCB]/70 p-5 sm:p-7 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#4A4A4A]">Granular Notification Events</h3>
              <p className="text-xs text-[#737373] font-medium mt-0.5">
                Choose which specific events trigger live notifications and alerts
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {[
                {
                  id: "articles",
                  title: "Article Pipeline Events",
                  desc: "Submissions, reviews, approvals, and redo requests",
                  icon: FileText,
                  checked: notifArticleStatus,
                  setter: setNotifArticleStatus,
                },
                {
                  id: "links",
                  title: "Link Operations & Issues",
                  desc: "Link additions, bridge updates, and issue reports",
                  icon: Link2,
                  checked: notifLinkIssues,
                  setter: setNotifLinkIssues,
                },
                {
                  id: "products",
                  title: "New Product Registrations",
                  desc: "Alerts when products are registered across sites",
                  icon: Package,
                  checked: notifProductAdded,
                  setter: setNotifProductAdded,
                },
                {
                  id: "broadcasts",
                  title: "Announcements & Broadcasts",
                  desc: "Real-time administrative notices and team updates",
                  icon: Sparkles,
                  checked: notifAnnouncements,
                  setter: setNotifAnnouncements,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <label
                    key={item.id}
                    className="flex items-start gap-3.5 p-4 rounded-2xl border border-[#CBCBCB]/60 bg-[#FAF9F5]/60 hover:bg-[#FAF9F5] transition cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.setter(e.target.checked)}
                      className="w-4 h-4 rounded mt-0.5 accent-[#6D8196] cursor-pointer"
                    />
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-[#6D8196]" />
                        <span className="text-xs font-bold text-[#4A4A4A]">{item.title}</span>
                      </div>
                      <p className="text-[11px] text-[#737373] leading-normal">{item.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="pt-4 border-t border-[#CBCBCB]/40 flex justify-end">
              <button
                type="button"
                onClick={handleSaveNotifications}
                className="px-5 py-2.5 bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Notification Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: WORKSPACE & DISPLAY ────────────────────────────────── */}
      {activeTab === "workspace" && (
        <div className="bg-white rounded-3xl border border-[#CBCBCB]/70 p-5 sm:p-7 shadow-xs space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-base font-bold text-[#4A4A4A]">Workspace & Interface Preferences</h2>
            <p className="text-xs text-[#737373] font-medium mt-0.5">
              Customize your default start screen, table layout density, and refresh behaviors
            </p>
          </div>

          <div className="space-y-5">
            {/* Default Landing Page */}
            <div>
              <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider mb-2">
                Default Landing Screen on Login
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { id: "/", label: "Main Dashboard", desc: "Overview & Analytics" },
                  { id: "/articles", label: "Article Studio", desc: "Writing queue" },
                  { id: "/products", label: "Product Catalog", desc: "Pipeline register" },
                  { id: "/links", label: "Link Operations", desc: "Bridge links" },
                  { id: "/reports", label: "Work Reports", desc: "Periodic logs" },
                  { id: "/calendar", label: "Work Calendar", desc: "Daily history" },
                ].map((dest) => (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => setDefaultLandingPage(dest.id)}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                      defaultLandingPage === dest.id
                        ? "border-[#6D8196] bg-[#6D8196]/10 shadow-2xs"
                        : "border-[#CBCBCB]/60 bg-[#FAF9F5] hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-xs font-bold text-[#4A4A4A] block">{dest.label}</span>
                    <span className="text-[11px] text-[#737373]">{dest.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Table Display Density */}
            <div>
              <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider mb-2">
                Table Row Density
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                <button
                  type="button"
                  onClick={() => setTableDensity("cozy")}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between ${
                    tableDensity === "cozy"
                      ? "border-[#6D8196] bg-[#6D8196]/10"
                      : "border-[#CBCBCB]/60 bg-[#FAF9F5]"
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-[#4A4A4A] block">Cozy (Default)</span>
                    <span className="text-[11px] text-[#737373]">Comfortable spacing and padded cells</span>
                  </div>
                  {tableDensity === "cozy" && <CheckCircle2 className="w-4 h-4 text-[#6D8196]" />}
                </button>

                <button
                  type="button"
                  onClick={() => setTableDensity("compact")}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between ${
                    tableDensity === "compact"
                      ? "border-[#6D8196] bg-[#6D8196]/10"
                      : "border-[#CBCBCB]/60 bg-[#FAF9F5]"
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-[#4A4A4A] block">Compact</span>
                    <span className="text-[11px] text-[#737373]">High density with reduced padding</span>
                  </div>
                  {tableDensity === "compact" && <CheckCircle2 className="w-4 h-4 text-[#6D8196]" />}
                </button>
              </div>
            </div>

            {/* Auto Refresh */}
            <div>
              <label className="block text-xs font-bold text-[#4A4A4A] uppercase tracking-wider mb-2">
                Live Data Polling Interval
              </label>
              <CustomSelect
                value={autoRefreshInterval}
                onChange={(val) => setAutoRefreshInterval(val)}
                options={[
                  { value: "15", label: "Every 15 seconds (High activity)" },
                  { value: "30", label: "Every 30 seconds (Standard default)" },
                  { value: "60", label: "Every 1 minute (Low network usage)" },
                  { value: "manual", label: "Manual refresh only" },
                ]}
                className="max-w-xs"
                triggerClassName="px-4 py-2.5 rounded-xl border border-[#CBCBCB] bg-white text-xs font-bold text-[#4A4A4A] hover:border-[#6D8196] shadow-2xs cursor-pointer"
                portal={true}
              />
            </div>

            <div className="pt-4 border-t border-[#CBCBCB]/40 flex justify-end">
              <button
                type="button"
                onClick={handleSaveWorkspace}
                className="px-5 py-2.5 bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Workspace Preferences</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: SECURITY & ACTIVE SESSION ──────────────────────────── */}
      {activeTab === "security" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Active Session & Device Information */}
          <div className="bg-white rounded-3xl border border-[#CBCBCB]/70 p-5 sm:p-7 shadow-xs space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#4A4A4A]">Active Authentication & Sessions</h2>
              <p className="text-xs text-[#737373] font-medium mt-0.5">
                Current connection details, session tokens, and security authentications
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF9F5] border border-[#CBCBCB]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#4A4A4A]">Google OAuth 2.0 Single Sign-On</span>
                    <span className="px-2 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                      Verified
                    </span>
                  </div>
                  <p className="text-xs text-[#737373] font-medium mt-0.5">
                    Authenticated with Google Identity Services. Passwords and credentials managed externally.
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs font-bold text-[#4A4A4A] block">256-bit SSL / TLS</span>
                <span className="text-[11px] text-emerald-600 font-semibold">Encrypted Traffic</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1.5">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Current Device</span>
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Monitor className="w-4 h-4 text-[#6D8196]" />
                  <span>Desktop Workstation</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Protocol: {typeof window !== "undefined" ? window.location.protocol.replace(":", "") : "HTTPS"}
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1.5">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Session Status</span>
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>JWT Token Active</span>
                </div>
                <p className="text-[11px] text-slate-500">Auto-refreshed with rolling cookie expiration</p>
              </div>
            </div>

            {/* Sign Out Action */}
            <div className="pt-4 border-t border-[#CBCBCB]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-[#737373]">
                <Info className="w-4 h-4 text-[#6D8196] shrink-0" />
                <span>Signing out will terminate your current browser token and disconnect real-time notifications.</span>
              </div>

              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out of Account</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
