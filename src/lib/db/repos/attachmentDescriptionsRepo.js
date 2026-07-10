import { getAdapter } from "../driver.js";

export async function getAttachmentDescription(cacheKey) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const row = db.get(
    "SELECT * FROM attachmentDescriptions WHERE cacheKey = ? AND expiresAt > ?",
    [cacheKey, now]
  );
  if (!row) return null;
  db.run("UPDATE attachmentDescriptions SET lastAccessedAt = ? WHERE cacheKey = ?", [now, cacheKey]);
  return row;
}

export async function putAttachmentDescription({ cacheKey, profileId, modality, model, promptVersion, description, expiresAt }) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO attachmentDescriptions(cacheKey, profileId, modality, model, promptVersion, description, expiresAt, createdAt, lastAccessedAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(cacheKey) DO UPDATE SET
       model = excluded.model,
       promptVersion = excluded.promptVersion,
       description = excluded.description,
       expiresAt = excluded.expiresAt,
       lastAccessedAt = excluded.lastAccessedAt`,
    [cacheKey, profileId, modality, model, promptVersion, description, expiresAt, now, now]
  );
}

export async function pruneAttachmentDescriptions({ maxEntries = 2000 } = {}) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  db.run("DELETE FROM attachmentDescriptions WHERE expiresAt <= ?", [now]);
  const count = db.get("SELECT COUNT(*) AS count FROM attachmentDescriptions")?.count || 0;
  if (count <= maxEntries) return 0;
  const remove = count - maxEntries;
  db.run(
    `DELETE FROM attachmentDescriptions WHERE cacheKey IN (
      SELECT cacheKey FROM attachmentDescriptions ORDER BY lastAccessedAt ASC LIMIT ?
    )`,
    [remove]
  );
  return remove;
}
