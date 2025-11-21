-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "gender" TEXT NOT NULL,
    "skillLevel" INTEGER NOT NULL,
    "timestamp" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("createdAt", "email", "gender", "id", "name", "skillLevel", "status", "teamId", "timestamp", "uuid") SELECT "createdAt", "email", "gender", "id", "name", "skillLevel", "status", "teamId", "timestamp", "uuid" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");
CREATE INDEX "Player_uuid_idx" ON "Player"("uuid");
CREATE INDEX "Player_status_idx" ON "Player"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
