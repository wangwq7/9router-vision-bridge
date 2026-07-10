import { NextResponse } from "next/server";
import {
  createVisionBridgeProfile,
  getComboByName,
  getVisionBridgeProfileByName,
  getVisionBridgeProfiles,
} from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ profiles: await getVisionBridgeProfiles() });
  } catch (error) {
    console.error("[VisionBridge] list profiles failed", error);
    return NextResponse.json({ error: "Failed to list Vision Bridge profiles" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    // The external model namespace is shared with existing combos.
    if (await getComboByName(body?.name)) {
      return NextResponse.json({ error: "Name is already used by a combo" }, { status: 409 });
    }
    if (await getVisionBridgeProfileByName(body?.name)) {
      return NextResponse.json({ error: "Vision Bridge profile name already exists" }, { status: 409 });
    }
    return NextResponse.json(await createVisionBridgeProfile(body), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to create Vision Bridge profile" }, { status: 400 });
  }
}
