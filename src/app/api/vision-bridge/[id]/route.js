import { NextResponse } from "next/server";
import {
  deleteVisionBridgeProfile,
  getComboByName,
  getVisionBridgeProfileById,
  getVisionBridgeProfileByName,
  updateVisionBridgeProfile,
} from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { id } = await params;
  const profile = await getVisionBridgeProfileById(id);
  return profile
    ? NextResponse.json(profile)
    : NextResponse.json({ error: "Vision Bridge profile not found" }, { status: 404 });
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const current = await getVisionBridgeProfileById(id);
    if (!current) return NextResponse.json({ error: "Vision Bridge profile not found" }, { status: 404 });

    if (body?.name && body.name !== current.name) {
      const [combo, profile] = await Promise.all([getComboByName(body.name), getVisionBridgeProfileByName(body.name)]);
      if (combo || (profile && profile.id !== id)) {
        return NextResponse.json({ error: "Name is already in use" }, { status: 409 });
      }
    }
    return NextResponse.json(await updateVisionBridgeProfile(id, body));
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to update Vision Bridge profile" }, { status: 400 });
  }
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const deleted = await deleteVisionBridgeProfile(id);
  return deleted
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: "Vision Bridge profile not found" }, { status: 404 });
}
