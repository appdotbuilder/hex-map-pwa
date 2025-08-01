
import { db } from '../db';
import { reportsTable, picturesTable, commentsTable } from '../db/schema';
import { type CreateReportInput, type Report } from '../schema';
import { eq, and, count } from 'drizzle-orm';

export async function createReport(input: CreateReportInput): Promise<Report> {
  try {
    // Validate that exactly one of picture_id or comment_id is provided
    const hasTargetId = Boolean(input.picture_id) !== Boolean(input.comment_id);
    if (!hasTargetId) {
      throw new Error('Must provide exactly one of picture_id or comment_id');
    }

    // Verify the target entity exists
    if (input.picture_id) {
      const pictures = await db.select()
        .from(picturesTable)
        .where(eq(picturesTable.id, input.picture_id))
        .execute();
      
      if (pictures.length === 0) {
        throw new Error('Picture not found');
      }
    }

    if (input.comment_id) {
      const comments = await db.select()
        .from(commentsTable)
        .where(eq(commentsTable.id, input.comment_id))
        .execute();
      
      if (comments.length === 0) {
        throw new Error('Comment not found');
      }
    }

    // Create the report
    const result = await db.insert(reportsTable)
      .values({
        reporter_user_id: input.reporter_user_id,
        picture_id: input.picture_id,
        comment_id: input.comment_id,
        reason: input.reason,
        description: input.description,
        status: 'pending'
      })
      .returning()
      .execute();

    const report = result[0];

    // Check if we should auto-flag the content based on report count
    await checkAndAutoFlag(input.picture_id, input.comment_id);

    return {
      ...report,
      created_at: report.created_at,
      reviewed_at: report.reviewed_at
    };
  } catch (error) {
    console.error('Report creation failed:', error);
    throw error;
  }
}

async function checkAndAutoFlag(pictureId: number | null, commentId: number | null): Promise<void> {
  const REPORT_THRESHOLD = 3; // Auto-flag after 3 reports

  try {
    // Count existing reports for this content
    const conditions: any[] = [eq(reportsTable.status, 'pending')];
    
    if (pictureId) {
      conditions.push(eq(reportsTable.picture_id, pictureId));
    } else if (commentId) {
      conditions.push(eq(reportsTable.comment_id, commentId));
    }

    const reportCounts = await db.select({ count: count() })
      .from(reportsTable)
      .where(and(...conditions))
      .execute();

    const reportCount = reportCounts[0]?.count || 0;

    // Auto-flag if threshold reached
    if (reportCount >= REPORT_THRESHOLD) {
      if (pictureId) {
        await db.update(picturesTable)
          .set({
            is_flagged: true,
            flag_reason: `Auto-flagged: ${reportCount} reports received`
          })
          .where(eq(picturesTable.id, pictureId))
          .execute();
      } else if (commentId) {
        await db.update(commentsTable)
          .set({
            is_flagged: true,
            flag_reason: `Auto-flagged: ${reportCount} reports received`
          })
          .where(eq(commentsTable.id, commentId))
          .execute();
      }
    }
  } catch (error) {
    console.error('Auto-flag check failed:', error);
    // Don't throw - report creation should still succeed
  }
}
