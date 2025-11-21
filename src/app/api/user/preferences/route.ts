import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });

    return NextResponse.json({ defaultFolderId: user?.defaultFolderId || "" });
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { defaultFolderId } = await req.json();

    const user = await prisma.user.upsert({
        where: { email: session.user.email },
        update: { defaultFolderId },
        create: {
            email: session.user.email,
            defaultFolderId,
        },
    });

    return NextResponse.json(user);
}
