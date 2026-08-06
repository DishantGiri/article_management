"use client";

import { useEffect, useState } from "react";
import { Settings as SettingsIcon, User, Save } from "lucide-react";
import { useSession } from "next-auth/react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"profile" | "linkDefaults">("profile");
  const [currentUserId, setCurrentUserId] = useState<number>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  
  // Global settings state
  const [defaultSubId, setDefaultSubId] = useState("");
  const [defaultBridgeUrl, setDefaultBridgeUrl] = useState("");
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [globalSuccess, setGlobalSuccess] = useState("");
  const [globalError, setGlobalError] = useState("");

  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.id) {
      setCurrentUserId(session.user.id);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [userRes, settingsRes] = await Promise.all([
          fetch(`/api/users/${currentUserId}`),
          fetch("/api/settings"),
        ]);
        
        if (userRes.ok) {
          const user = await userRes.json();
          setName(user.name || session?.user?.name || "");
          setEmail(user.email || session?.user?.email || "");
        } else if (session?.user) {
          setName(session.user.name || "");
          setEmail(session.user.email || "");
        }

        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          setDefaultSubId(settings.defaultSubId || "");
          setDefaultBridgeUrl(settings.defaultBridgeUrl || "");
        }
      } catch (err) {
        console.error("Failed to fetch settings data:", err);
      } finally {
        setLoading(false);
      }
    };
    if (currentUserId) {
      fetchData();
    }
  }, [currentUserId, session?.user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/users/${currentUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        setSuccess("Settings updated successfully.");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update settings.");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGlobal(true);
    setGlobalError("");
    setGlobalSuccess("");

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultSubId, defaultBridgeUrl }),
      });

      if (res.ok) {
        setGlobalSuccess("Global defaults saved successfully.");
      } else {
        const data = await res.json();
        setGlobalError(data.error || "Failed to save global settings.");
      }
    } catch (err) {
      setGlobalError("An unexpected error occurred.");
    } finally {
      setSavingGlobal(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your account and system preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("profile")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "profile"
                ? "border-indigo-500 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("linkDefaults")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "linkDefaults"
                ? "border-indigo-500 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Global Link Defaults (Sub ID & Bridge Page)
          </button>
        </nav>
      </div>

      {/* Profile Tab Content */}
      {activeTab === "profile" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl">
          {loading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              {error && (
                <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium">
                  {success}
                </div>
              )}

              {/* Profile Info */}
              <div className="flex items-center gap-4 pb-4">
                <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold">
                  {name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'JD'}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{name || 'Your Name'}</h2>
                  <p className="text-sm text-slate-500 mb-2">{email || 'yourmail@example.com'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    placeholder="Your Name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    readOnly
                    disabled
                    className="block w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-400 focus:outline-none cursor-not-allowed"
                  />
                </div>
                
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Global Link Defaults Tab Content */}
      {activeTab === "linkDefaults" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl">
          {loading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
            </div>
          ) : (
            <form onSubmit={handleSaveGlobal} className="space-y-6">
              {globalError && (
                <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium">
                  {globalError}
                </div>
              )}
              {globalSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium">
                  {globalSuccess}
                </div>
              )}

              <div>
                <h2 className="text-base font-bold text-slate-900">Global Defaults for Sub ID & Bridge Page</h2>
                <p className="text-xs text-slate-500 mt-1">
                  These fallback settings will be automatically applied when a site does not have custom Sub ID or Bridge Page Base URL configured.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Default Global Sub ID
                  </label>
                  <input
                    type="text"
                    value={defaultSubId}
                    onChange={(e) => setDefaultSubId(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
                    placeholder="e.g. global_sub_01"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Fallback Sub ID applied when creating link logs if no site-specific Sub ID exists.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Default Global Bridge Page Base URL
                  </label>
                  <input
                    type="url"
                    value={defaultBridgeUrl}
                    onChange={(e) => setDefaultBridgeUrl(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. https://globalbridge.com/pages"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Product name slug will be automatically appended (e.g. https://globalbridge.com/pages/product-slug).</p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingGlobal}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {savingGlobal ? "Saving..." : "Save Global Settings"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
