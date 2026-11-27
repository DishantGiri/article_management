export interface TeamLeadSummary {
  id: string;
  name: string;
}

/**
 * Prisma where-filter matching a writer assigned to a specific Team Lead
 * via either the legacy `teamLeadId` FK or the `WriterTeamLead` join table.
 */
export function isWriterAssignedToTlFilter(tlId: string) {
  return {
    OR: [
      { teamLeadId: tlId },
      { writerTeamLeads: { some: { teamLeadId: tlId } } },
    ],
  };
}

/**
 * Collects all unique Team Lead IDs assigned to a writer.
 */
export function getWriterTeamLeadIds(
  writer?: {
    teamLeadId?: string | null;
    writerTeamLeads?: Array<{
      teamLeadId?: string | null;
      teamLead?: { id: string } | null;
    }>;
  } | null
): string[] {
  if (!writer) return [];
  const ids = new Set<string>();
  if (Array.isArray(writer.writerTeamLeads)) {
    for (const rel of writer.writerTeamLeads) {
      const id = rel.teamLead?.id || rel.teamLeadId;
      if (id) ids.add(String(id));
    }
  }
  if (writer.teamLeadId) {
    ids.add(String(writer.teamLeadId));
  }
  return Array.from(ids);
}

/**
 * Extracts normalized `{ id, name }[]` Team Leads and primary `teamLead`
 * from a Prisma User row that includes `teamLead` and `writerTeamLeads`.
 */
export function extractWriterTeamLeads(user: {
  teamLead?: TeamLeadSummary | null;
  writerTeamLeads?: Array<{ teamLead?: TeamLeadSummary | null }>;
}): { teamLeads: TeamLeadSummary[]; teamLead: TeamLeadSummary | null } {
  const byId = new Map<string, TeamLeadSummary>();

  if (Array.isArray(user.writerTeamLeads)) {
    for (const rel of user.writerTeamLeads) {
      if (rel.teamLead?.id && !byId.has(rel.teamLead.id)) {
        byId.set(rel.teamLead.id, { id: rel.teamLead.id, name: rel.teamLead.name });
      }
    }
  }
  if (user.teamLead?.id && !byId.has(user.teamLead.id)) {
    byId.set(user.teamLead.id, { id: user.teamLead.id, name: user.teamLead.name });
  }

  const teamLeads = Array.from(byId.values());
  const teamLead = user.teamLead
    ? { id: user.teamLead.id, name: user.teamLead.name }
    : teamLeads[0] || null;

  return { teamLeads, teamLead };
}

/**
 * Extracts normalized `{ id, name }[]` team members (writers) from a Team Lead user row
 * merging both legacy `teamMembers` and M:N `teamLeadWriters`.
 */
export function extractTeamLeadMembers(user: {
  teamMembers?: TeamLeadSummary[];
  teamLeadWriters?: Array<{ writer?: TeamLeadSummary | null }>;
}): TeamLeadSummary[] {
  const byId = new Map<string, TeamLeadSummary>();

  if (Array.isArray(user.teamLeadWriters)) {
    for (const rel of user.teamLeadWriters) {
      if (rel.writer?.id && !byId.has(rel.writer.id)) {
        byId.set(rel.writer.id, { id: rel.writer.id, name: rel.writer.name });
      }
    }
  }
  if (Array.isArray(user.teamMembers)) {
    for (const m of user.teamMembers) {
      if (m?.id && !byId.has(m.id)) {
        byId.set(m.id, { id: m.id, name: m.name });
      }
    }
  }

  return Array.from(byId.values());
}

/**
 * Formats a Prisma User object for API responses with `teamLeads`, `teamLead`, and `teamMembers`
 * while stripping raw join-table wrapper arrays.
 */
export function formatUserWithTeamRelations<
  T extends {
    teamLead?: TeamLeadSummary | null;
    teamMembers?: TeamLeadSummary[];
    writerTeamLeads?: Array<{ teamLead?: TeamLeadSummary | null }>;
    teamLeadWriters?: Array<{ writer?: TeamLeadSummary | null }>;
  }
>(user: T) {
  const { teamLeads, teamLead } = extractWriterTeamLeads(user);
  const teamMembers = extractTeamLeadMembers(user);
  const { writerTeamLeads: _w, teamLeadWriters: _t, ...rest } = user;
  return {
    ...rest,
    teamLead,
    teamLeads,
    teamMembers,
  };
}

/**
 * Parses either `teamLeadIds` (array) or legacy `teamLeadId` (single value) from request body.
 * Returns `undefined` if neither key was provided in the payload.
 */
export function parseIncomingTeamLeadIds(body: {
  teamLeadIds?: unknown;
  teamLeadId?: unknown;
}): string[] | undefined {
  if (body.teamLeadIds !== undefined) {
    const rawArr = Array.isArray(body.teamLeadIds) ? body.teamLeadIds : [];
    const ids = new Set<string>();
    for (const val of rawArr) {
      const cleaned = String(val ?? "").trim();
      if (cleaned && cleaned !== "none") {
        ids.add(cleaned);
      }
    }
    return Array.from(ids);
  }

  if (body.teamLeadId !== undefined) {
    const cleaned =
      body.teamLeadId && body.teamLeadId !== "none" && body.teamLeadId !== ""
        ? String(body.teamLeadId).trim()
        : "";
    return cleaned ? [cleaned] : [];
  }

  return undefined;
}
