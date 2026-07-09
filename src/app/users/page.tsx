"use client";

import { useEffect, useState } from "react";
import { Search, Plus, Pencil, Trash2, X, Users } from "lucide-react";
import { useSession } from "next-auth/react";

interface Site {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "LINKER" | "WRITER" | "TEAM_LEAD";
  allowLinkLogAccess: boolean;
  siteAccess: {
    site: {
      id: number;
      name: string;
    };
  }[];
  teamLead?: {
    id: number;
    name: string;
  };
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  LINKER: "Linker",
  WRITER: "Writer",
  TEAM_LEAD: "Team Lead",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const [currentUserRole, setCurrentUserRole] = useState("ADMIN");
  const [currentUserId, setCurrentUserId] = useState<number>(1);
  const { data: session } = useSession();

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "WRITER",
    siteIds: [] as number[],
    teamLeadId: "",
    allowLinkLogAccess: false,
  });

  const teamLeads = users.filter((u) => u.role === "TEAM_LEAD");

  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    const stored = session.user.id;
    setCurrentUserId(stored);
    const uRole = session.user.role || "ADMIN";
    setCurrentUserRole(uRole);

    Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/sites").then((r) => r.json()),
      fetch(`/api/dashboard?userId=${stored}`).then((r) => r.json()),
    ]).then(([usersData, sitesData, dashboardData]) => {
      setUsers(Array.isArray(usersData) ? usersData : []);
      setSites(Array.isArray(sitesData) ? sitesData : []);
      setStats(dashboardData);
    }).finally(() => setLoading(false));
  }, [session?.user?.id]);

  const openAddModal = () => {
    setEditingUserId(null);
    setForm({ name: "", email: "", role: "WRITER", siteIds: [], teamLeadId: "", allowLinkLogAccess: false });
    setError("");
    setShowModal(true);
  };

  const openEditModal = (u: User) => {
    setEditingUserId(u.id);
    setForm({ 
      name: u.name, 
      email: u.email, 
      role: u.role, 
      siteIds: u.siteAccess ? u.siteAccess.map(sa => sa.site.id) : [], 
      teamLeadId: u.teamLead ? String(u.teamLead.id) : "",
      allowLinkLogAccess: u.allowLinkLogAccess 
    });
    setError("");
    setShowModal(true);
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${id}?creatorId=${currentUserId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (e: any) {
      alert(e.message || "Failed to delete user");
    }
  };

  const handleSaveUser = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const url = editingUserId ? `/api/users/${editingUserId}` : "/api/users";
      const method = editingUserId ? "PATCH" : "POST";
      
      const payload = { ...form, creatorId: currentUserId };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (editingUserId) {
        setUsers((prev) => prev.map(u => u.id === editingUserId ? data : u));
        setSuccess("User updated successfully!");
      } else {
        setUsers((prev) => [data, ...prev]);
        setSuccess("User created successfully!");
      }
      
      setShowModal(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const filtered = users.filter((u) => {
    if (currentUserRole === "TEAM_LEAD") {
      if (u.teamLead?.id !== currentUserId) return false;
    }
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderPagination = () => {
    const pages = [];
    for (let i = 1; i <= Math.min(5, totalPages); i++) pages.push(i);
    return (
      <div className="flex items-center justify-between mt-4 py-3 px-2 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-400">
          Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
        </p>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50"
          >
            &lt;
          </button>
          {pages.map(p => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold ${
                currentPage === p 
                  ? "bg-indigo-500 text-white border border-indigo-500 shadow-sm" 
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}
          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50"
          >
            &gt;
          </button>
        </div>
      </div>
    );
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getMockStatus = (id: number) => {
    return id % 3 === 0 ? "Idle" : "Active";
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#f8fafc]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {currentUserRole === "TEAM_LEAD" ? "Your Team Members" : "User Management"}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">{filtered.length} users</p>
        </div>
        {currentUserRole !== "TEAM_LEAD" && (
          <button 
            onClick={openAddModal}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-semibold hover:bg-indigo-600 shadow-sm transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        )}
      </div>

      {/* Metric Cards Row */}
      {stats && currentUserRole !== "TEAM_LEAD" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center text-violet-500 mb-2">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.superAdmin?.totalWriters || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Writers</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-fuchsia-50 flex items-center justify-center text-fuchsia-500 mb-2">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.superAdmin?.totalLinkers || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Linkers</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-500 mb-2">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.superAdmin?.totalTeamLeads || 0}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Team Leads</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between h-32">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 mb-2">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{users.filter((u) => getMockStatus(u.id) === "Active").length}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">Active Users</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6 bg-white p-2 rounded-xl border border-slate-200 shadow-sm w-fit">
        <div className="relative w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg border-none text-sm focus:outline-none focus:ring-0 bg-transparent placeholder-slate-400 font-medium text-slate-700"
          />
        </div>
        <div className="w-px h-6 bg-slate-200 mx-1"></div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 rounded-lg border-none text-sm font-semibold text-slate-600 bg-transparent focus:outline-none focus:ring-0 appearance-none cursor-pointer"
        >
          <option value="">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-slate-500 font-medium">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[30%]">Name</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[30%]">Email</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[15%]">Role</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[15%]">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[10%] text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((u) => {
                  const status = getMockStatus(u.id);
                  const isWriter = u.role.toLowerCase().includes('writer');
                  const roleBg = isWriter ? "bg-indigo-50" : "bg-purple-50";
                  const roleText = isWriter ? "text-indigo-600" : "text-purple-600";
                  
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full ${roleBg} ${roleText} flex items-center justify-center text-[10px] font-bold`}>
                            {getInitials(u.name)}
                          </div>
                          <span className="text-[13px] font-medium text-slate-700">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[13px] font-medium text-slate-500">{u.email}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${roleBg} ${roleText}`}>
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                          {u.teamLead && (
                            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                              Lead: {u.teamLead.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {currentUserRole !== "TEAM_LEAD" && (
                          <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditModal(u)} className="text-slate-400 hover:text-indigo-500 transition">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteUser(u.id)} className="text-slate-400 hover:text-rose-500 transition">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {renderPagination()}
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">{editingUserId ? "Edit User" : "Add New User"}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-rose-50 text-rose-600 text-sm font-medium rounded-lg">{error}</div>}
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Sarah Mitchell"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  disabled={!!editingUserId}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-slate-50"
                  placeholder="sarah@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="WRITER">Writer</option>
                  <option value="LINKER">Linker</option>
                  <option value="TEAM_LEAD">Team Lead</option>
                  {currentUserRole === "SUPER_ADMIN" && <option value="ADMIN">Admin</option>}
                  {form.role === "SUPER_ADMIN" && <option value="SUPER_ADMIN">Super Admin</option>}
                </select>
              </div>

              {(form.role === "WRITER" || form.role === "TEAM_LEAD") && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assign Websites</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto p-3 bg-slate-50 rounded-lg border border-slate-100">
                    {sites.map(site => (
                      <label key={site.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.siteIds.includes(site.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, siteIds: [...form.siteIds, site.id] });
                            } else {
                              setForm({ ...form, siteIds: form.siteIds.filter(id => id !== site.id) });
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-700">{site.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {form.role === "WRITER" && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assign Team Lead</label>
                  <select
                    value={form.teamLeadId}
                    onChange={(e) => setForm({ ...form, teamLeadId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="">No Team Lead</option>
                    {teamLeads.map((tl) => (
                      <option key={tl.id} value={tl.id}>{tl.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={saving || !form.name || (!editingUserId && !form.email)}
                className="px-5 py-2 bg-indigo-500 text-white rounded-lg text-sm font-semibold hover:bg-indigo-600 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : (editingUserId ? "Save Changes" : "Add User")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
