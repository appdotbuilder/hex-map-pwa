
import { db } from '../db';
import { reportsTable } from '../db/schema';
import { type Report } from '../schema';
import { desc } from 'drizzle-orm';

export async function getReports(): Promise<Report[]> {
  try {
    const results = await db.select()
      .from(reportsTable)
      .orderBy(desc(reportsTable.created_at))
      .execute();

    return results.map(report => ({
      ...report,
      created_at: report.created_at!,
      reviewed_at: report.reviewed_at
    }));
  } catch (error) {
    console.error('Failed to fetch reports:', error);
    throw error;
  }
}
