import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";
import { isSuperAdmin, ROLES } from "./roles";

export const authOptions: AuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
            authorization: {
                params: {
                    scope: "openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets.readonly",
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code"
                }
            }
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (!user.email) return false;

            // Upsert user in database
            const dbUser = await prisma.user.upsert({
                where: { email: user.email },
                update: {
                    name: user.name || undefined,
                },
                create: {
                    email: user.email,
                    name: user.name || undefined,
                    role: isSuperAdmin(user.email) ? ROLES.SUPER_ADMIN : ROLES.USER,
                },
            });

            return true;
        },
        async session({ session, token }) {
            if (session && session.user?.email) {
                (session as any).accessToken = token.accessToken;

                // Fetch user role from database
                const dbUser = await prisma.user.findUnique({
                    where: { email: session.user.email },
                    select: { role: true, id: true },
                });

                if (dbUser) {
                    (session as any).user.role = dbUser.role;
                    (session as any).user.id = dbUser.id;
                }
            }
            return session;
        },
        async jwt({ token, account }) {
            if (account) {
                token.accessToken = account.access_token;
            }
            return token;
        },
    },
};
