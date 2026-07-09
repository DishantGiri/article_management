import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      // Enforce email domain restriction
      if (!user.email.endsWith("@fishtailinfosolutions.com")) {
        console.log(`SignIn Rejected: Email domain not allowed: ${user.email}`);
        return false;
      }

      try {
        // Find existing user by email
        let dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        // Auto-create unrecognized Google logins with null role and pending approval (approved: false)
        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              name: user.name || "Google User",
              email: user.email,
              password: "", // password is not used with OAuth provider
              role: null, // No role assigned initially
              approved: false, // Wait for admin approval
            },
          });
          console.log(`Auto-created user for Google sign-in: ${user.email} with null role (pending approval)`);
        }
        return true;
      } catch (err) {
        console.error("Error in signIn callback:", err);
        return false;
      }
    },
    async jwt({ token, trigger, session }) {
      if (trigger === "update" && session) {
        if (session.role !== undefined) {
          token.role = session.role;
        }
      }
      if (token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
            select: { id: true, role: true, approved: true },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.approved = dbUser.approved;
            if (trigger !== "update") {
              token.role = dbUser.role;
            }
          }
        } catch (err) {
          console.error("Error in jwt callback fetching user:", err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.approved = token.approved;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "f6c8d76d49ba9c32e987c674251df8ae",
  pages: {
    signIn: "/auth/signin",
  },
};
