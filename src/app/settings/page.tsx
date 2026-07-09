"use client";

import { useEffect, useState } from "react";
import { Settings as SettingsIcon, User, Save } from "lucide-react";
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
    const fetchUser = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const users = await res.json();
          const user = users.find((u: any) => u.id === currentUserId);
          if (user) {
            setName(user.name);
            setEmail(user.email || "");
          }
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
      } finally {
        setLoading(false);
      }
    };
    if (currentUserId) {
      fetchUser();
    }
  }, [currentUserId]);

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
        // We dispatch an event so that the sidebar could potentially listen to it, 
        // though mock users are hardcoded currently.
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
          <button className="border-indigo-500 text-indigo-600 whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm">Profile</button>
          <button className="border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm">Password</button>
        </nav>
      </div>

      {/* Settings Form */}
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
                <h2 className="text-lg font-bold text-slate-900">{name || 'John Doe'}</h2>
                <p className="text-sm text-slate-500 mb-2">{email || 'john@example.com'}</p>
                <button type="button" className="text-xs font-medium px-3 py-1 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
                  Change Photo
                </button>
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
                  placeholder="John Doe"
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

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Phone
                </label>
                <input
                  type="text"
                  defaultValue="+1 (555) 000-0000"
                  className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
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
    </div>
  );
}
