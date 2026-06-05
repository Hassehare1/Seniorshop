import "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
    districtId: string | null;
    districtNumber: number | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
      districtId: string | null;
      districtNumber: number | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    districtId: string | null;
    districtNumber: number | null;
  }
}
