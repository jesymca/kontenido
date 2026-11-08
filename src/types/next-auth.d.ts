import { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

/**
 * Extensiones de tipos de TypeScript para NextAuth v5
 * Permite tipado estricto en session.user y token JWT
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: "SUPER_ADMIN" | "CREATOR" | "CONSUMER" | "AGENCY";
      status: "PENDING" | "ACTIVE" | "SUSPENDED";
      kycStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
      level: number;
      vipMembershipId?: string | null;
      allowDownload: number;
      suspensionReason?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username: string;
    role: "SUPER_ADMIN" | "CREATOR" | "CONSUMER" | "AGENCY";
    status: "PENDING" | "ACTIVE" | "SUSPENDED";
    kycStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
    level: number;
    vipMembershipId?: string | null;
    allowDownload: number;
    suspensionReason?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: "SUPER_ADMIN" | "CREATOR" | "CONSUMER" | "AGENCY";
    status: "PENDING" | "ACTIVE" | "SUSPENDED";
    kycStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
    level: number;
    vipMembershipId?: string | null;
    allowDownload: number;
    suspensionReason?: string | null;
  }
}
