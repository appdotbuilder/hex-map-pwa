
import { db } from '../db';
import { reportsTable, picturesTable, commentsTable } from '../db/schema';
import { type UpdateReportStatusInput, type Report } from '../schema';
import { eq } from 'drizzle-orm';

export const updateReportStatus = async (input: UpdateReportStatusInput): Promise<Report> => {
  try {
    // First, get the current report to check what content it's flagging
    const existingReports = await db.select()
      .from(reportsTable)
      .where(eq(reportsTable.id, input.report_id))
      .execute();

    if (existingReports.length === 0) {
      throw new Error(`Report with id ${input.report_id} not found`);
    }

    const existingReport = existingReports[0];

    // Update the report status and admin notes
    const updatedReports = await db.update(reportsTable)
      .set({
        status: input.status,
        admin_notes: input.admin_notes,
        reviewed_at: new Date()
      })
      .where(eq(reportsTable.id, input.report_id))
      .returning()
      .execute();

    const updatedReport = updatedReports[0];

    // If status is 'reviewed', flag the associated content
    if (input.status === 'reviewed') {
      if (existingReport.picture_id) {
        await db.update(picturesTable)
          .set({
            is_flagged: true,
            flag_reason: existingReport.reason
          })
          .where(eq(picturesTable.id, existingReport.picture_id))
          .execute();
      }

      if (existingReport.comment_id) {
        await db.update(commentsTable)
          .set({
            is_flagged: true,
            flag_reason: existingReport.reason
          })
          .where(eq(commentsTable.id, existingReport.comment_id))
          .execute();
      }
    }

    return updatedReport;
  } catch (error) {
    console.error('Report status update failed:', error);
    throw error;
  }
};
