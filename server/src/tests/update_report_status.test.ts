
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, picturesTable, commentsTable, reportsTable } from '../db/schema';
import { type UpdateReportStatusInput } from '../schema';
import { updateReportStatus } from '../handlers/update_report_status';
import { eq } from 'drizzle-orm';

describe('updateReportStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update report status and set reviewed_at timestamp', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({ device_id: 'test-device', is_admin: false })
      .returning()
      .execute();

    const picture = await db.insert(picturesTable)
      .values({
        user_id: user[0].id,
        filename: 'test.jpg',
        original_filename: 'test.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024
      })
      .returning()
      .execute();

    const report = await db.insert(reportsTable)
      .values({
        reporter_user_id: user[0].id,
        picture_id: picture[0].id,
        comment_id: null,
        reason: 'inappropriate',
        description: 'Test report',
        status: 'pending'
      })
      .returning()
      .execute();

    const input: UpdateReportStatusInput = {
      report_id: report[0].id,
      status: 'dismissed',
      admin_notes: 'Not inappropriate'
    };

    const result = await updateReportStatus(input);

    expect(result.id).toEqual(report[0].id);
    expect(result.status).toEqual('dismissed');
    expect(result.admin_notes).toEqual('Not inappropriate');
    expect(result.reviewed_at).toBeInstanceOf(Date);
  });

  it('should flag picture when report status is reviewed', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({ device_id: 'test-device', is_admin: false })
      .returning()
      .execute();

    const picture = await db.insert(picturesTable)
      .values({
        user_id: user[0].id,
        filename: 'test.jpg',
        original_filename: 'test.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
        is_flagged: false
      })
      .returning()
      .execute();

    const report = await db.insert(reportsTable)
      .values({
        reporter_user_id: user[0].id,
        picture_id: picture[0].id,
        comment_id: null,
        reason: 'spam',
        description: 'This is spam',
        status: 'pending'
      })
      .returning()
      .execute();

    const input: UpdateReportStatusInput = {
      report_id: report[0].id,
      status: 'reviewed',
      admin_notes: 'Confirmed spam'
    };

    await updateReportStatus(input);

    // Check that picture was flagged
    const updatedPictures = await db.select()
      .from(picturesTable)
      .where(eq(picturesTable.id, picture[0].id))
      .execute();

    expect(updatedPictures[0].is_flagged).toBe(true);
    expect(updatedPictures[0].flag_reason).toEqual('spam');
  });

  it('should flag comment when report status is reviewed', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({ device_id: 'test-device', is_admin: false })
      .returning()
      .execute();

    const picture = await db.insert(picturesTable)
      .values({
        user_id: user[0].id,
        filename: 'test.jpg',
        original_filename: 'test.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024
      })
      .returning()
      .execute();

    const comment = await db.insert(commentsTable)
      .values({
        picture_id: picture[0].id,
        user_id: user[0].id,
        content: 'Test comment',
        is_flagged: false
      })
      .returning()
      .execute();

    const report = await db.insert(reportsTable)
      .values({
        reporter_user_id: user[0].id,
        picture_id: null,
        comment_id: comment[0].id,
        reason: 'harassment',
        description: 'Harassing comment',
        status: 'pending'
      })
      .returning()
      .execute();

    const input: UpdateReportStatusInput = {
      report_id: report[0].id,
      status: 'reviewed',
      admin_notes: 'Confirmed harassment'
    };

    await updateReportStatus(input);

    // Check that comment was flagged
    const updatedComments = await db.select()
      .from(commentsTable)
      .where(eq(commentsTable.id, comment[0].id))
      .execute();

    expect(updatedComments[0].is_flagged).toBe(true);
    expect(updatedComments[0].flag_reason).toEqual('harassment');
  });

  it('should not flag content when report status is dismissed', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({ device_id: 'test-device', is_admin: false })
      .returning()
      .execute();

    const picture = await db.insert(picturesTable)
      .values({
        user_id: user[0].id,
        filename: 'test.jpg',
        original_filename: 'test.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
        is_flagged: false
      })
      .returning()
      .execute();

    const report = await db.insert(reportsTable)
      .values({
        reporter_user_id: user[0].id,
        picture_id: picture[0].id,
        comment_id: null,
        reason: 'inappropriate',
        description: 'False report',
        status: 'pending'
      })
      .returning()
      .execute();

    const input: UpdateReportStatusInput = {
      report_id: report[0].id,
      status: 'dismissed',
      admin_notes: 'Not inappropriate'
    };

    await updateReportStatus(input);

    // Check that picture was not flagged
    const updatedPictures = await db.select()
      .from(picturesTable)
      .where(eq(picturesTable.id, picture[0].id))
      .execute();

    expect(updatedPictures[0].is_flagged).toBe(false);
  });

  it('should throw error when report does not exist', async () => {
    const input: UpdateReportStatusInput = {
      report_id: 999,
      status: 'reviewed',
      admin_notes: 'Test notes'
    };

    expect(updateReportStatus(input)).rejects.toThrow(/not found/i);
  });

  it('should save report to database with correct data', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({ device_id: 'test-device', is_admin: false })
      .returning()
      .execute();

    const picture = await db.insert(picturesTable)
      .values({
        user_id: user[0].id,
        filename: 'test.jpg',
        original_filename: 'test.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024
      })
      .returning()
      .execute();

    const report = await db.insert(reportsTable)
      .values({
        reporter_user_id: user[0].id,
        picture_id: picture[0].id,
        comment_id: null,
        reason: 'copyright',
        description: 'Copyright violation',
        status: 'pending'
      })
      .returning()
      .execute();

    const input: UpdateReportStatusInput = {
      report_id: report[0].id,
      status: 'reviewed',
      admin_notes: 'Confirmed copyright violation'
    };

    const result = await updateReportStatus(input);

    // Verify report was saved to database
    const savedReports = await db.select()
      .from(reportsTable)
      .where(eq(reportsTable.id, result.id))
      .execute();

    expect(savedReports).toHaveLength(1);
    expect(savedReports[0].status).toEqual('reviewed');
    expect(savedReports[0].admin_notes).toEqual('Confirmed copyright violation');
    expect(savedReports[0].reviewed_at).toBeInstanceOf(Date);
  });
});
