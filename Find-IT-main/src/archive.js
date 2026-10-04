const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const archiveDb = new DatabaseSync(path.join(dataDir, "findit_archive.db"));
archiveDb.exec(`
  CREATE TABLE IF NOT EXISTS archive_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_type TEXT NOT NULL CHECK (record_type IN ('user', 'item', 'claim')),
    record_id INTEGER NOT NULL,
    summary TEXT NOT NULL,
    payload TEXT NOT NULL,
    archived_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_archive_entries_archived
    ON archive_entries(archived_at DESC);
`);

function archiveAndDelete(db, records, removeActiveRecords) {
  const insert = archiveDb.prepare(
    "INSERT INTO archive_entries (record_type, record_id, summary, payload) VALUES (?, ?, ?, ?)"
  );
  const archiveIds = [];

  archiveDb.exec("BEGIN");
  try {
    for (const record of records) {
      const result = insert.run(
        record.type,
        record.id,
        record.summary,
        JSON.stringify(record.payload)
      );
      archiveIds.push(Number(result.lastInsertRowid));
    }
    archiveDb.exec("COMMIT");
  } catch (error) {
    archiveDb.exec("ROLLBACK");
    throw error;
  }

  let activeTransaction = false;
  try {
    db.exec("BEGIN");
    activeTransaction = true;
    removeActiveRecords();
    db.exec("COMMIT");
    activeTransaction = false;
  } catch (error) {
    if (activeTransaction) db.exec("ROLLBACK");
    const removeArchive = archiveDb.prepare("DELETE FROM archive_entries WHERE id = ?");
    archiveDb.exec("BEGIN");
    try {
      for (const id of archiveIds) removeArchive.run(id);
      archiveDb.exec("COMMIT");
    } catch (cleanupError) {
      archiveDb.exec("ROLLBACK");
      throw cleanupError;
    }
    throw error;
  }
}

function listArchives() {
  return archiveDb
    .prepare(
      `SELECT id, record_type AS type, record_id AS recordId, summary, archived_at AS archivedAt
       FROM archive_entries
       ORDER BY archived_at DESC, id DESC`
    )
    .all();
}

function getArchive(id) {
  return archiveDb.prepare("SELECT * FROM archive_entries WHERE id = ?").get(id);
}

function removeArchive(id) {
  archiveDb.prepare("DELETE FROM archive_entries WHERE id = ?").run(id);
}

module.exports = { archiveAndDelete, listArchives, getArchive, removeArchive };
