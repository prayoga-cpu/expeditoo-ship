import { emailService } from "@/server/services/email.service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
  }

  try {
    const { to, name } = await request.json();
    
    await emailService.sendWelcomeEmail(
      to || "test@example.com", 
      name || "Test User"
    );

    return NextResponse.json({ success: true, message: "Email sent (check console if no API Key)" });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
