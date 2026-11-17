import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createPostForCreator } from "@/lib/posts";

export const dynamic = "force-dynamic";

/**
 * Endpoint REST fallback para guardar una nueva publicación cuando la Server Action
 * falla por un error de red o versión desfasada del cliente.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const result = await createPostForCreator(session.user, {
      title: body?.title,
      description: body?.description,
      priceKoin: body?.priceKoin,
      isPublicTeaser: body?.isPublicTeaser,
      mediaItems: body?.mediaItems,
      managedCreatorId: body?.managedCreatorId,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Error guardando publicación en /api/posts:", err);
    return NextResponse.json(
      { error: err?.message || "Error al guardar la publicación." },
      { status: 500 }
    );
  }
}
