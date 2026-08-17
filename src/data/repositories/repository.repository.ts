import { eq } from "drizzle-orm";
import { getDb } from "../db/connection.js";
import { repositories } from "../db/schema.js";
import type { PrScannerConfig } from "../../config/schema.js";

export class RepositoryRepository {
  constructor(private config: PrScannerConfig) {}

  /** Find or create a repository record */
  upsert(fullName: string, platform: string): number {
    const db = getDb(this.config);

    const existing = db
      .select()
      .from(repositories)
      .where(eq(repositories.fullName, fullName))
      .get();

    if (existing) {
      return existing.id;
    }

    const result = db
      .insert(repositories)
      .values({ fullName, platform })
      .returning({ id: repositories.id })
      .get();

    return result!.id;
  }

  /** Update last scanned timestamp */
  updateLastScanned(id: number): void {
    const db = getDb(this.config);
    db.update(repositories)
      .set({ lastScannedAt: new Date().toISOString() })
      .where(eq(repositories.id, id))
      .run();
  }

  /** Find by full name */
  findByName(fullName: string) {
    const db = getDb(this.config);
    return db.select().from(repositories).where(eq(repositories.fullName, fullName)).get();
  }
}
