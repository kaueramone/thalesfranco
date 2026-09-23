import { NextResponse } from "next/server";
import { authorize, fail } from "@/lib/server";
export async function GET(req: Request) {
  try {
    await authorize(req);
    return NextResponse.json({
      email: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
      whatsapp: !!(
        process.env.WHATSAPP_ACCESS_TOKEN &&
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_GRAPH_VERSION &&
        process.env.WHATSAPP_TEMPLATE_NAME
      ),
      url: !!process.env.APP_URL,
    });
  } catch (e) {
    return fail(e);
  }
}
