import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { storageService } from "@/server/services/storage.service";
import { imageService } from "@/server/services/image.service";
import { nanoid } from "nanoid";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BAD_REQUEST", message: "No file provided" },
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BAD_REQUEST", message: "File must be an image" },
        },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Compress image
    const {
      buffer: compressedBuffer,
      mimeType,
      ext,
    } = await imageService.compress(buffer);

    // Generate unique filename
    const fileName = `${session.user.id}/${nanoid()}.${ext}`;

    // Upload to storage
    const url = await storageService.uploadImage(
      compressedBuffer,
      fileName,
      mimeType
    );

    return NextResponse.json({ success: true, data: { url } });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}
