/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

const providers: any[] = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  }),
];

if (process.env.NODE_ENV === "development") {
  providers.push(
    CredentialsProvider({
      name: "Testing",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        // Enforce email domain restriction
        if (!credentials.email.endsWith("@fishtailinfosolutions.com")) {
          return null;
        }

        let user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              name: credentials.email.split("@")[0],
              email: credentials.email,
              role: null,
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
        } as any;
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
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

        if (dbUser) {
          // Update profile image if it has changed or is newly available
          if (user.image && dbUser.image !== user.image) {
            dbUser = await prisma.user.update({
              where: { email: user.email },
              data: { image: user.image },
            });
          }
        } else {
          // Auto-create unrecognized Google logins with null role and pending approval (approved: false)
          dbUser = await prisma.user.create({
            data: {
              name: user.name || "Google User",
              email: user.email,
              role: null, // No role assigned initially
              approved: false, // Wait for admin approval
              image: user.image || null,
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
            select: { id: true, role: true, approved: true, image: true },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.approved = dbUser.approved;
            token.image = dbUser.image;
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
        session.user.image = token.image as string | null | undefined;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/signin",
  },
};

