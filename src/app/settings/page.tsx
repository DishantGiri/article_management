"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function SettingsPage() {
  const [currentUserId, setCurrentUserId] = useState<number>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

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
        const userRes = await fetch(`/api/users/${currentUserId}`);
        
        if (userRes.ok) {
          const user = await userRes.json();
          setName(user.name || session?.user?.name || "");
          setEmail(user.email || session?.user?.email || "");
        } else if (session?.user) {
          setName(session.user.name || "");
          setEmail(session.user.email || "");
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your personal profile and account preferences
        </p>
      </div>

      {/* Profile Settings Content */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 max-w-2xl">
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold">
                {success}
              </div>
            )}

            {/* Profile Info */}
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-bold">
                {name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{name || 'Your Name'}</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{email || 'yourmail@example.com'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs"
                  placeholder="Your Name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  className="block w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-400 focus:outline-none cursor-not-allowed"
                />
              </div>
              
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                >
                  {saving ? "Saving..." : "Save Profile Changes"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
