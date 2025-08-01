
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, picturesTable, commentsTable, reportsTable } from '../db/schema';
import { type CreateReportInput } from '../schema';
import { createReport } from '../handlers/create_report';
import { eq, and } from 'drizzle-orm';

describe('createReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser: any;
  let testPicture: any;
  let testComment: any;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        device_id: 'test-device-123',
        is_admin: false
      })
      .returning()
      .execute();
    testUser = userResult[0];

    // Create test picture
    const pictureResult = await db.insert(picturesTable)
      .values({
        user_id: testUser.id,
        filename: 'test.jpg',
        original_filename: 'test.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
        width: 800,
        height: 600
      })
      .returning()
      .execute();
    testPicture = pictureResult[0];

    // Create test comment
    const commentResult = await db.insert(commentsTable)
      .values({
        picture_id: testPicture.id,
        user_id: testUser.id,
        content: 'Test comment'
      })
      .returning()
      .execute();
    testComment = commentResult[0];
  });

  it('should create a report for a picture', async () => {
    const input: CreateReportInput = {
      reporter_user_id: testUser.id,
      picture_id: testPicture.id,
      comment_id: null,
      reason: 'inappropriate',
      description: 'This picture is inappropriate'
    };

    const result = await createReport(input);

    expect(result.reporter_user_id).toEqual(testUser.id);
    expect(result.picture_id).toEqual(testPicture.id);
    expect(result.comment_id).toBeNull();
    expect(result.reason).toEqual('inappropriate');
    expect(result.description).toEqual('This picture is inappropriate');
    expect(result.status).toEqual('pending');
    expect(result.admin_notes).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.reviewed_at).toBeNull();
  });

  it('should create a report for a comment', async () => {
    const input: CreateReportInput = {
      reporter_user_id: testUser.id,
      picture_id: null,
      comment_id: testComment.id,
      reason: 'spam',
      description: null
    };

    const result = await createReport(input);

    expect(result.reporter_user_id).toEqual(testUser.id);
    expect(result.picture_id).toBeNull();
    expect(result.comment_id).toEqual(testComment.id);
    expect(result.reason).toEqual('spam');
    expect(result.description).toBeNull();
    expect(result.status).toEqual('pending');
  });

  it('should save report to database', async () => {
    const input: CreateReportInput = {
      reporter_user_id: testUser.id,
      picture_id: testPicture.id,
      comment_id: null,
      reason: 'copyright',
      description: 'Copyright violation'
    };

    const result = await createReport(input);

    const reports = await db.select()
      .from(reportsTable)
      .where(eq(reportsTable.id, result.id))
      .execute();

    expect(reports).toHaveLength(1);
    expect(reports[0].reporter_user_id).toEqual(testUser.id);
    expect(reports[0].picture_id).toEqual(testPicture.id);
    expect(reports[0].reason).toEqual('copyright');
    expect(reports[0].status).toEqual('pending');
  });

  it('should throw error if both picture_id and comment_id are provided', async () => {
    const input: CreateReportInput = {
      reporter_user_id: testUser.id,
      picture_id: testPicture.id,
      comment_id: testComment.id,
      reason: 'inappropriate',
      description: null
    };

    await expect(createReport(input)).rejects.toThrow(/exactly one of picture_id or comment_id/i);
  });

  it('should throw error if neither picture_id nor comment_id are provided', async () => {
    const input: CreateReportInput = {
      reporter_user_id: testUser.id,
      picture_id: null,
      comment_id: null,
      reason: 'inappropriate',
      description: null
    };

    await expect(createReport(input)).rejects.toThrow(/exactly one of picture_id or comment_id/i);
  });

  it('should throw error if picture does not exist', async () => {
    const input: CreateReportInput = {
      reporter_user_id: testUser.id,
      picture_id: 99999,
      comment_id: null,
      reason: 'inappropriate',
      description: null
    };

    await expect(createReport(input)).rejects.toThrow(/picture not found/i);
  });

  it('should throw error if comment does not exist', async () => {
    const input: CreateReportInput = {
      reporter_user_id: testUser.id,
      picture_id: null,
      comment_id: 99999,
      reason: 'inappropriate',
      description: null
    };

    await expect(createReport(input)).rejects.toThrow(/comment not found/i);
  });

  it('should auto-flag picture after multiple reports', async () => {
    // Create 3 reports for the same picture to trigger auto-flagging
    const reportInputs: CreateReportInput[] = [
      {
        reporter_user_id: testUser.id,
        picture_id: testPicture.id,
        comment_id: null,
        reason: 'inappropriate',
        description: 'First report'
      },
      {
        reporter_user_id: testUser.id,
        picture_id: testPicture.id,
        comment_id: null,
        reason: 'spam',
        description: 'Second report'
      },
      {
        reporter_user_id: testUser.id,
        picture_id: testPicture.id,
        comment_id: null,
        reason: 'harassment',
        description: 'Third report'
      }
    ];

    // Create all three reports
    for (const input of reportInputs) {
      await createReport(input);
    }

    // Check if picture was auto-flagged
    const pictures = await db.select()
      .from(picturesTable)
      .where(eq(picturesTable.id, testPicture.id))
      .execute();

    expect(pictures[0].is_flagged).toBe(true);
    expect(pictures[0].flag_reason).toMatch(/auto-flagged.*3.*reports/i);
  });

  it('should auto-flag comment after multiple reports', async () => {
    // Create 3 reports for the same comment to trigger auto-flagging
    const reportInputs: CreateReportInput[] = [
      {
        reporter_user_id: testUser.id,
        picture_id: null,
        comment_id: testComment.id,
        reason: 'inappropriate',
        description: 'First report'
      },
      {
        reporter_user_id: testUser.id,
        picture_id: null,
        comment_id: testComment.id,
        reason: 'spam',
        description: 'Second report'
      },
      {
        reporter_user_id: testUser.id,
        picture_id: null,
        comment_id: testComment.id,
        reason: 'harassment',
        description: 'Third report'
      }
    ];

    // Create all three reports
    for (const input of reportInputs) {
      await createReport(input);
    }

    // Check if comment was auto-flagged
    const comments = await db.select()
      .from(commentsTable)
      .where(eq(commentsTable.id, testComment.id))
      .execute();

    expect(comments[0].is_flagged).toBe(true);
    expect(comments[0].flag_reason).toMatch(/auto-flagged.*3.*reports/i);
  });
});
