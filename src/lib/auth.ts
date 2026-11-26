/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { sanitizeUserName } from "@/lib/user-validation";

const providers: any[] = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  }),
  CredentialsProvider({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "text" },
    },
    async authorize(credentials) {
      if (!credentials?.email) return null;

      let email = credentials.email.trim().toLowerCase();
      if (!email.includes("@")) {
        email = `${email}@fishtailinfosolutions.com`;
      }

      // Enforce email domain restriction
      if (!email.endsWith("@fishtailinfosolutions.com")) {
        return null;
      }
      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Also check if user exists by short prefix
        const prefix = email.split("@")[0];
        user = await prisma.user.findFirst({
          where: {
            OR: [
              { email },
              { email: { startsWith: prefix + "@" } },
            ],
          },
        });
      }

      // Strictly deny login if user has left the company
      if (user?.hasLeftCompany) {
        console.log(`Authorize Rejected: User has left company: ${email}`);
        return null;
      }

      if (!user) {
        const rawName = email.split("@")[0].replace(/[._-]/g, " ");
        const initialName = sanitizeUserName(rawName) || "User";
        user = await prisma.user.create({
          data: {
            name: initialName,
            email: email,
            role: "GUEST",
            approved: false,
          },
        });
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        approved: user.approved,
        hasLeftCompany: user.hasLeftCompany,
      } as any;
    },
  }),
];

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const email = user.email.trim().toLowerCase();

      // Enforce email domain restriction
      if (!email.endsWith("@fishtailinfosolutions.com")) {
        console.log(`SignIn Rejected: Email domain not allowed: ${email}`);
        return "/auth/signin?error=AccessDenied";
      }

      try {
        const prefix = email.split("@")[0];
        // Find exact user email first, then fall back to prefix match
        let dbUser =
          (await prisma.user.findUnique({ where: { email } })) ||
          (await prisma.user.findFirst({
            where: {
              email: { startsWith: prefix + "@" },
            },
          }));

        // Strictly reject login if user has left company
        if (dbUser?.hasLeftCompany) {
          console.log(`SignIn Rejected: User has left company: ${email}`);
          return "/auth/signin?error=AccountDeactivated";
        }

        if (dbUser) {
          // Update profile image if it has changed or is newly available (best-effort)
          if (user.image && dbUser.image !== user.image && user.image.length <= 191) {
            try {
              dbUser = await prisma.user.update({
                where: { id: dbUser.id },
                data: { image: user.image },
              });
            } catch (imgErr) {
              console.warn("Non-fatal: failed updating user avatar:", imgErr);
            }
          }
        } else {
          // Auto-create unrecognized Google logins with GUEST role and pending approval (approved: false)
          const initialName = sanitizeUserName(user.name || "") || "Google User";
          dbUser = await prisma.user.create({
            data: {
              name: initialName,
              email,
              role: "GUEST", // Auto-assigned GUEST role upon registration
              approved: false, // Wait for admin approval
              image: user.image && user.image.length <= 191 ? user.image : null,
            },
          });
          console.log(`Auto-created user for Google sign-in: ${email} with GUEST role (pending approval)`);
        }
        return true;
      } catch (err) {
        console.error("Error in signIn callback:", err);
        return "/auth/signin?error=DatabaseError";
      }
    },
    async jwt({ token, trigger, session }) {
      const now = Date.now();
      const lastChecked = (token.lastChecked as number | undefined) ?? 0;
      // Revalidate unapproved/GUEST users frequently (5s), approved users every 60s
      const ttlMs = token.approved === false ? 5_000 : 15_000;
      const shouldRefresh =
        trigger === "signIn" ||
        trigger === "update" ||
        !token.id ||
        now - lastChecked > ttlMs;

      if (token.email && shouldRefresh) {
        try {
          const dbUser = await prisma.user.findFirst({
            where: {
              OR: [
                { email: token.email },
                ...(token.id ? [{ id: String(token.id) }] : []),
              ],
            },
            select: {
              id: true,
              name: true,
              role: true,
              approved: true,
              hasLeftCompany: true,
              image: true,
              siteAccess: {
                select: {
                  role: true,
                  roles: true,
                },
              },
            },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.name = dbUser.name;
            token.hasLeftCompany = Boolean(dbUser.hasLeftCompany);
            token.approved = dbUser.hasLeftCompany ? false : dbUser.approved;
            token.image = dbUser.image;
            const roleSet = new Set<string>();
            if (dbUser.role) roleSet.add(dbUser.role.toUpperCase());
            (dbUser.siteAccess || []).forEach((sa) => {
              if (sa.role) roleSet.add(sa.role.toUpperCase());
              if (sa.roles) {
                sa.roles.split(",").forEach((r) => {
                  const trimmed = r.trim().toUpperCase();
                  if (trimmed) roleSet.add(trimmed);
                });
              }
            });
            const computedRole = dbUser.role || (roleSet.size > 0 ? Array.from(roleSet)[0] : "GUEST");
            if (roleSet.size === 0) roleSet.add("GUEST");
            token.role = computedRole;
            token.roles = Array.from(roleSet);
            token.lastChecked = now;

            // If user role is null in DB during signIn/background check, persist GUEST role to User table
            if (!dbUser.role && trigger !== "update") {
              prisma.user.update({
                where: { id: dbUser.id },
                data: { role: "GUEST" },
              }).catch(() => {});
            }
          }
        } catch (err) {
          console.error("Error in jwt callback fetching user:", err);
        }
      }
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.image !== undefined) token.image = session.image;
        if (session.role !== undefined) {
          token.role = session.role;
          token.roles = session.role ? [session.role] : [];
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.name = token.name;
        const fallbackRole = token.role || (token.roles && token.roles.length > 0 ? token.roles[0] : "GUEST");
        session.user.role = fallbackRole;
        session.user.roles = token.roles || (fallbackRole ? [fallbackRole] : ["GUEST"]);
        session.user.approved = token.approved;
        (session.user as any).hasLeftCompany = Boolean(token.hasLeftCompany);
        session.user.image = token.image as string | null | undefined;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
};

