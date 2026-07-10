import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";
import { normalizeVisionBridgeProfile } from "@/lib/visionBridge/config";

function rowToProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled !== 0,
    config: parseJson(row.config, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getVisionBridgeProfiles() {
  const db = await getAdapter();
  return db.all("SELECT * FROM visionBridgeProfiles ORDER BY createdAt ASC").map(rowToProfile);
}

export async function getVisionBridgeProfileById(id) {
  const db = await getAdapter();
  return rowToProfile(db.get("SELECT * FROM visionBridgeProfiles WHERE id = ?", [id]));
}

export async function getVisionBridgeProfileByName(name) {
  const db = await getAdapter();
  return rowToProfile(db.get("SELECT * FROM visionBridgeProfiles WHERE name = ?", [name]));
}

export async function createVisionBridgeProfile(input) {
  const profile = normalizeVisionBridgeProfile(input);
  const db = await getAdapter();
  const now = new Date().toISOString();
  const row = { id: uuidv4(), ...profile, createdAt: now, updatedAt: now };
  db.run(
    "INSERT INTO visionBridgeProfiles(id, name, enabled, config, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?)",
    [row.id, row.name, row.enabled ? 1 : 0, stringifyJson(row.config), row.createdAt, row.updatedAt]
  );
  return row;
}

export async function updateVisionBridgeProfile(id, input) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const current = rowToProfile(db.get("SELECT * FROM visionBridgeProfiles WHERE id = ?", [id]));
    if (!current) return;
    const next = normalizeVisionBridgeProfile({ ...current, ...input, config: input.config ?? current.config });
    result = { ...current, ...next, updatedAt: new Date().toISOString() };
    db.run(
      "UPDATE visionBridgeProfiles SET name = ?, enabled = ?, config = ?, updatedAt = ? WHERE id = ?",
      [result.name, result.enabled ? 1 : 0, stringifyJson(result.config), result.updatedAt, id]
    );
  });
  return result;
}

export async function deleteVisionBridgeProfile(id) {
  const db = await getAdapter();
  const res = db.run("DELETE FROM visionBridgeProfiles WHERE id = ?", [id]);
  return (res?.changes ?? 0) > 0;
}
