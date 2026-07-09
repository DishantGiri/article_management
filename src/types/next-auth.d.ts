import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: number;
      role: string | null;
      approved: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: number;
    role: string | null;
    approved: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: number;
    role: string | null;
    approved: boolean;
  }
}
