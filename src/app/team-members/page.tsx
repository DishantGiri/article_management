"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Users, FileText, Clock, Calendar, ChevronRight, Mail, Search, BarChart2, LayoutGrid, List } from "lucide-react";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  stats: {
    totalArticles: number;
    avgWritingTimeMin: number;
    avgArticlesPerDay: number;
    avgArticlesPerWeek: number;
  };
  recentArticles: Array<{
    id: number;
    productName: string;
    completedAt: string;
    writingTimeMin: number | null;
  }>;
}

export default function TeamMembersPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    if (!session?.user?.id) return;

    const uId = session.user.id;
    const uRole = session.user.role;

    if (uRole !== "TEAM_LEAD" && uRole !== "ADMIN" && uRole !== "SUPER_ADMIN") {
      router.push("/");
      return;
    }

    fetch(`/api/team-members?userId=${uId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setMembers(data);
        }
      })
      .catch(() => setError("Failed to fetch team member statistics"))
      .finally(() => setLoading(false));
  }, [session?.user?.id, session?.user?.role, router]);

  const formatWritingTime = (mins: number) => {
    if (!mins) return "N/A";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-rose-500 font-bold bg-slate-50 min-h-screen">
        Error loading team performance dashboard: {error}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-gray-50 space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Team Members
          </h1>
          <p className="text-base text-gray-500 mt-2">
            Analyze productivity metrics and track time records for your writers.
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 p-1 rounded-md border border-gray-200">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition-colors ${
                viewMode === "grid" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition-colors ${
                viewMode === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
              title="List View"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {filteredMembers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center shadow-sm">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Team Members Found</h3>
          <p className="text-sm text-gray-500 mt-1">
            {searchTerm ? "Try a different search term." : "Writers assigned to your team will appear here."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredMembers.map((member) => (
            <div key={member.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
              
              {/* Member Info */}
              <div className="p-5 border-b border-gray-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-semibold flex-shrink-0">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-medium text-gray-900 truncate">{member.name}</h3>
                  <p className="text-sm text-gray-500 truncate">{member.email}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="p-5 grid grid-cols-2 gap-4 bg-gray-50/50 border-b border-gray-100">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Articles</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">{member.stats.totalArticles}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Speed</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1 truncate" title={formatWritingTime(member.stats.avgWritingTimeMin)}>
                    {formatWritingTime(member.stats.avgWritingTimeMin)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Per Day</p>
                  <p className="text-lg font-medium text-gray-700 mt-1">{member.stats.avgArticlesPerDay}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Per Week</p>
                  <p className="text-lg font-medium text-gray-700 mt-1">{member.stats.avgArticlesPerWeek}</p>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="p-5 flex-1 bg-white">
                <h4 className="text-sm font-medium text-gray-900 mb-4">Recent Articles</h4>
                {member.recentArticles.length === 0 ? (
                  <p className="text-sm text-gray-500">No completed articles.</p>
                ) : (
                  <div className="space-y-3">
                    {member.recentArticles.map((article) => (
                      <div
                        key={article.id}
                        onClick={() => router.push(`/articles/${article.id}`)}
                        className="group flex items-center justify-between cursor-pointer"
                      >
                        <div className="min-w-0 pr-4">
                          <p className="text-sm font-medium text-blue-600 group-hover:underline truncate">
                            {article.productName}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(article.completedAt).toLocaleDateString()}
                          </p>
                        </div>
                        {article.writingTimeMin && (
                          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded whitespace-nowrap">
                            {formatWritingTime(article.writingTimeMin)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team Member
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Articles
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Speed
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg / Day
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg / Week
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {member.stats.totalArticles}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatWritingTime(member.stats.avgWritingTimeMin)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.stats.avgArticlesPerDay}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.stats.avgArticlesPerWeek}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
