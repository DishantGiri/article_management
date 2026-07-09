"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { FileText, LayoutGrid, Globe, ExternalLink, Copy, Clock, CheckCircle2, Flag, Lock, Shield, User, Calendar } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface Article {
  id: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "APPROVED" | "REDO";
  articleLink?: string;
  startedAt?: string;
  completedAt?: string;
  writingTimeMin?: number;
  updateTimeMin?: number;
  productCreatedAt?: string;
  updatedAt: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  specialApprovalRequested?: boolean;
  specialApprovalRequestReason?: string;
  product: {
    id: number; name: string; trendLink?: string; previewLink?: string; remarks?: string;
    site: { id: number; name: string }; category: { name: string }; addedBy: { name: string };
    linkLogs: { id: number; affiliateName: string; affiliateLink: string; bridgePageLink?: string; buyLink?: string; status: string; geos: { geo: string }[]; addedBy: { name: string }; addedAt: string }[];
  };
  writer?: { id: number; name: string };
  reviews: { id: number; suggestion?: string; approved: boolean; reviewedBy: { id: number; name: string }; reviewedAt: string }[];
  specialApproval?: { reason: string; approvedBy: { name: string }; approvedAt: string };
  history: { id: number; notes: string; updatedAt: string; updatedBy: { id: number; name: string } }[];
}

const ensureExternalUrl = (url: string | null | undefined) => {
  if (!url) return "";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export default function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(2);
  const [currentUserRole, setCurrentUserRole] = useState("WRITER");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [remark, setRemark] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [editLinkMode, setEditLinkMode] = useState(false);
  const [newLinkValue, setNewLinkValue] = useState("");
  const [updatingLink, setUpdatingLink] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.id) return;
    const uId = session.user.id;
    setCurrentUserId(uId);
    const uRole = session.user.role || "WRITER";
    setCurrentUserRole(uRole);

    if (uRole === "WRITER") {
      router.push("/");
      return;
    }

    fetch(`/api/articles/${id}?userId=${uId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setArticle(null);
        } else {
          setArticle(data);
        }
      })
      .catch(() => setError("Failed to fetch article details"))
      .finally(() => setLoading(false));
  }, [id, router, session?.user?.id]);

  useEffect(() => {
    if (article?.articleLink) {
      setNewLinkValue(article.articleLink);
    }
  }, [article]);

  const handleReviewSubmit = async (approved: boolean) => {
    if (!remark.trim() && !approved) {
      setError("Please provide feedback remarks when requesting a redo.");
      return;
    }
    setSubmittingReview(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article?.id,
          reviewedById: currentUserId,
          suggestion: remark,
          approved,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit review");
      
      setSuccess(approved ? "Article approved successfully!" : "Redo request submitted successfully.");
      setRemark("");
      
      // Refresh article data
      const refreshRes = await fetch(`/api/articles/${id}?userId=${currentUserId}`);
      const freshData = await refreshRes.json();
      if (!refreshRes.ok) throw new Error(freshData.error);
      setArticle(freshData);
    } catch (err: any) {
      setError(err.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!article) return <div className="p-8 text-rose-500 font-bold bg-slate-50 min-h-screen">Article not found or access denied.</div>;

  const { product } = article;

  return (
    <div className="p-8 max-w-[1400px] mx-auto min-h-screen bg-slate-50">
      {/* Header & Back Button */}
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm font-bold text-slate-500 hover:text-slate-800 transition flex items-center gap-1.5">
          &larr; Back
        </button>
        <div className="flex gap-3 items-center">
          {currentUserRole === "TEAM_LEAD" || currentUserRole === "ADMIN" || currentUserRole === "SUPER_ADMIN" ? (
             <select
               value={article.priority || "MEDIUM"}
               onChange={async (e) => {
                 const newPriority = e.target.value;
                 setError("");
                 setSuccess("");
                 try {
                   const res = await fetch(`/api/articles/${id}`, {
                     method: "PATCH",
                     headers: { "Content-Type": "application/json" },
                     body: JSON.stringify({ priority: newPriority, callerId: currentUserId }),
                   });
                   const data = res.ok ? await res.json() : null;
                   if (!res.ok) throw new Error(data?.error || "Failed to update priority");
                   setArticle((prev) => prev ? { ...prev, priority: newPriority as any } : prev);
                   setSuccess("Priority updated successfully");
                 } catch (err: any) {
                   setError(err.message || "Failed to update priority");
                 }
               }}
               className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 shadow-sm cursor-pointer"
             >
               <option value="HIGH">High Priority</option>
               <option value="MEDIUM">Medium Priority</option>
               <option value="LOW">Low Priority</option>
             </select>
          ) : (
             <span className={`px-4 py-2.5 rounded-xl text-sm font-bold border bg-white ${
               article.priority === "HIGH" ? "text-rose-700 border-rose-200" :
               article.priority === "LOW" ? "text-blue-700 border-blue-200" :
               "text-amber-700 border-amber-200"
             }`}>
               {article.priority || "MEDIUM"} Priority
             </span>
          )}
        </div>
      </div>

      {error && <div className="mb-6 px-5 py-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-semibold">{error}</div>}
      {success && <div className="mb-6 px-5 py-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-semibold">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Product Info (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative">
             <div className="flex items-center justify-between mb-6">
                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  article.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border border-blue-200/50' :
                  article.status === 'REDO' ? 'bg-rose-50 text-rose-700 border border-rose-200/50' :
                  article.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' :
                  article.status === 'COMPLETED' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/50' :
                  'bg-amber-50 text-amber-700 border border-amber-200/50'
                }`}>
                  {(article.status === 'IN_PROGRESS' || article.status === 'REDO') && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>}
                  {article.status === 'REDO' ? 'Needs Changes' : article.status.charAt(0) + article.status.slice(1).toLowerCase()}
                </span>
               
               {article.writer && (
                 <div className="text-right">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Assigned Writer</p>
                   <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 justify-end"><User className="w-3.5 h-3.5 text-slate-400" /> {article.writer.name}</p>
                 </div>
               )}
             </div>

             <h2 className="text-3xl font-bold text-slate-900 mb-4">{product.name}</h2>
             
             <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 font-medium mb-8">
               <span className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> {product.site.name}</span>
               <span className="flex items-center gap-1.5"><LayoutGrid className="w-4 h-4" /> {product.category.name}</span>
               <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> Added by {product.addedBy.name}</span>
             </div>

             <div className="flex items-center gap-3 mb-8 pb-8 border-b border-slate-100">
               {product.trendLink && (
                 <a href={product.trendLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition">
                   <ExternalLink className="w-4 h-4" /> Trend Link
                 </a>
               )}
               {product.previewLink && (
                 <a href={product.previewLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold transition">
                   <Globe className="w-4 h-4" /> Preview Link
                 </a>
               )}
               {product.remarks && (
                 <div className="px-4 py-2 bg-amber-50 text-amber-800 rounded-lg text-sm font-semibold border border-amber-100 flex-1">
                   Remarks: {product.remarks}
                 </div>
               )}
             </div>

             <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4">Affiliate Links & Geos</h3>
                {product.linkLogs?.length > 0 ? (
                  <div className="space-y-3">
                    {product.linkLogs.map((log: any) => (
                      <div key={log.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-bold text-slate-800 text-sm">{log.affiliateName}</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{log.status}</span>
                        </div>
                        <div className="space-y-1.5 mb-2">
                          {log.affiliateLink && (
                            <div><span className="text-[10px] font-bold text-slate-400 uppercase">Affiliate Link:</span> <a href={log.affiliateLink} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline break-all block truncate">{log.affiliateLink}</a></div>
                          )}
                          {log.bridgePageLink && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between">
                                Bridge Page:
                                <button onClick={() => { navigator.clipboard.writeText(log.bridgePageLink); alert("Copied bridge page link!"); }} className="p-1 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition" title="Copy Bridge Page Link"><Copy className="w-3.5 h-3.5" /></button>
                              </span> 
                              <a href={log.bridgePageLink} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline break-all block truncate mt-0.5">{log.bridgePageLink}</a>
                            </div>
                          )}
                          {log.buyLink && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between">
                                Buy Link:
                                <button onClick={() => { navigator.clipboard.writeText(log.buyLink); alert("Copied buy link!"); }} className="p-1 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition" title="Copy Buy Link"><Copy className="w-3.5 h-3.5" /></button>
                              </span> 
                              <a href={log.buyLink} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline break-all block truncate mt-0.5">{log.buyLink}</a>
                            </div>
                          )}
                        </div>
                        {log.geos?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {log.geos.map((g: any) => (
                              <span key={g.geo} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-500">{g.geo}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No links available for this product.</p>
                )}
             </div>
          </div>
        </div>

        {/* Right Sidebar: Tracking Info & Workflow */}
        <div className="space-y-6">
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Tracking Details</h3>
              
              <div className="space-y-4">
                 {/* Timing info */}
                 <div className="grid grid-cols-2 gap-4">
                   {article.startedAt && (
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Started</p>
                       <p className="text-xs font-semibold text-slate-700">{new Date(article.startedAt).toLocaleDateString()}</p>
                     </div>
                   )}
                   {article.completedAt && (
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Completed</p>
                       <p className="text-xs font-semibold text-slate-700">{new Date(article.completedAt).toLocaleDateString()}</p>
                     </div>
                   )}
                 </div>
                 
                 {article.writingTimeMin !== undefined && article.writingTimeMin !== null && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Writing Time</p>
                      <p className="text-sm font-bold text-slate-800">{article.writingTimeMin >= 60 ? `${Math.floor(article.writingTimeMin / 60)}h ${article.writingTimeMin % 60}m` : `${article.writingTimeMin}m`}</p>
                    </div>
                  )}

                  {article.updateTimeMin !== undefined && article.updateTimeMin !== null && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Revision / Redo Time</p>
                      <p className="text-sm font-bold text-slate-800">{article.updateTimeMin >= 60 ? `${Math.floor(article.updateTimeMin / 60)}h ${article.updateTimeMin % 60}m` : `${article.updateTimeMin}m`}</p>
                    </div>
                  )}
                                  {/* Submitted Article Link / Edit Link Form */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Submitted Document</p>
                      {(currentUserRole === "TEAM_LEAD" || currentUserRole === "ADMIN" || currentUserRole === "SUPER_ADMIN") && !editLinkMode && (
                        <button
                          onClick={() => {
                            setNewLinkValue(article.articleLink || "");
                            setEditLinkMode(true);
                          }}
                          className="text-[10px] text-indigo-650 hover:text-indigo-850 font-bold transition cursor-pointer"
                        >
                          Edit Link
                        </button>
                      )}
                    </div>

                    {editLinkMode ? (
                      <div className="space-y-2">
                        <input
                          type="url"
                          value={newLinkValue}
                          onChange={(e) => setNewLinkValue(e.target.value)}
                          placeholder="https://docs.google.com/..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setEditLinkMode(false)}
                            className="px-2.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-[11px] font-bold hover:bg-slate-50 transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              setUpdatingLink(true);
                              setError("");
                              setSuccess("");
                              try {
                                const res = await fetch(`/api/articles/${article.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    articleLink: newLinkValue,
                                    callerId: currentUserId,
                                    ...(article.status === "REDO" ? { status: "COMPLETED" } : {}),
                                  }),
                                });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || "Failed to update link");
                                
                                setSuccess(article.status === "REDO" ? "Article updated and marked Completed!" : "Article link updated successfully!");
                                setEditLinkMode(false);
                                
                                // Refresh article details
                                const refreshRes = await fetch(`/api/articles/${id}?userId=${currentUserId}`);
                                const freshData = await refreshRes.json();
                                if (!refreshRes.ok) throw new Error(freshData.error);
                                setArticle(freshData);
                              } catch (err: any) {
                                setError(err.message || "Failed to update link");
                              } finally {
                                setUpdatingLink(false);
                              }
                            }}
                            disabled={updatingLink}
                            className="px-2.5 py-1.5 bg-black hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      article.articleLink ? (
                        <a href={ensureExternalUrl(article.articleLink)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition break-all leading-tight text-center">
                          <ExternalLink className="w-4 h-4 flex-shrink-0" />
                          Open Document
                        </a>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No document link submitted yet.</p>
                      )
                    )}
                  </div>

                 {/* Special Approval Notice */}
                 {article.specialApprovalRequested && !article.specialApproval && (
                   <div className="pt-4 border-t border-slate-100">
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-2">
                           <Flag className="w-4 h-4" /> Approval Requested
                        </div>
                        <p className="text-xs text-amber-800 font-medium mb-1">The writer has requested to complete this without a link.</p>
                        {article.specialApprovalRequestReason && (
                          <p className="text-xs text-amber-600 italic bg-amber-100/50 p-2 rounded">"{article.specialApprovalRequestReason}"</p>
                        )}
                      </div>
                   </div>
                 )}

                 {article.specialApproval && (
                   <div className="pt-4 border-t border-slate-100">
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-2">
                           <Shield className="w-4 h-4" /> Special Approval Granted
                        </div>
                        <p className="text-xs text-emerald-800 font-medium mb-1">Approved by {article.specialApproval.approvedBy.name}</p>
                        <p className="text-xs text-emerald-600 italic">"{article.specialApproval.reason}"</p>
                      </div>
                   </div>
                 )}

                 {/* Team Lead Reviews */}
                 {article.reviews && article.reviews.length > 0 && (
                   <div className="pt-4 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Team Lead Reviews</p>
                      <div className="space-y-3">
                        {article.reviews.map((r) => (
                          <div key={r.id} className={`p-3 rounded-xl ${r.approved ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"}`}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-bold text-slate-700">{r.reviewedBy.name}</p>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.approved ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                                {r.approved ? "APPROVED" : "NEEDS CHANGES"}
                              </span>
                            </div>
                            {r.suggestion && <p className="text-xs text-slate-600 italic">"{r.suggestion}"</p>}
                          </div>
                        ))}
                      </div>
                   </div>
                  )}

                  {/* Article Update History */}
                  {article.history && article.history.length > 0 && (
                    <div className="pt-4 border-t border-slate-100">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Update History</p>
                       <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                         {article.history.map((h) => (
                           <div key={h.id} className="relative pl-4 border-l border-slate-200 py-0.5 text-left">
                             <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300 border border-white" />
                             <div className="flex items-center justify-between gap-2 mb-0.5">
                               <p className="text-[10px] font-bold text-slate-700 truncate">{h.updatedBy.name}</p>
                               <span className="text-[9px] text-slate-400 font-semibold flex-shrink-0">
                                 {new Date(h.updatedAt).toLocaleDateString()} {new Date(h.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                               </span>
                             </div>
                             <p className="text-[11px] text-slate-500 font-medium leading-normal">{h.notes}</p>
                           </div>
                         ))}
                       </div>
                    </div>
                  )}
               </div>
            </div>

            {/* Team Lead Review Panel Card */}
            {(currentUserRole === "TEAM_LEAD" || currentUserRole === "ADMIN" || currentUserRole === "SUPER_ADMIN") && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Review Article</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Provide feedback, request revisions, or approve this article.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Review Remarks / Suggestions
                    </label>
                    <textarea
                      rows={4}
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder="Enter feedback or change requests for the writer..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleReviewSubmit(false)}
                      disabled={submittingReview}
                      className="py-2.5 px-4 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      Request Redo
                    </button>
                    <button
                      onClick={() => handleReviewSubmit(true)}
                      disabled={submittingReview}
                      className="py-2.5 px-4 bg-[#69F0AE] hover:bg-[#52d698] text-slate-900 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
