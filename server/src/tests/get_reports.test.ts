
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, picturesTable, commentsTable, reportsTable } from '../db/schema';
import { getReports } from '../handlers/get_reports';

describe('getReports', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no reports exist', async () => {
    const result = await getReports();
    
    expect(result).toEqual([]);
  });

  it('should return all reports ordered by created_at desc', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        device_id: 'test-device-1',
        is_admin: false
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create test picture
    const pictureResult = await db.insert(picturesTable)
      .values({
        user_id: userId,
        filename: 'test.jpg',
        original_filename: 'original.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024
      })
      .returning()
      .execute();
    const pictureId = pictureResult[0].id;

    // Create test comment
    const commentResult = await db.insert(commentsTable)
      .values({
        picture_id: pictureId,
        user_id: userId,
        content: 'Test comment'
      })
      .returning()
      .execute();
    const commentId = commentResult[0].id;

    // Create multiple reports with slight delay to ensure different timestamps
    await db.insert(reportsTable)
      .values({
        reporter_user_id: userId,
        picture_id: pictureId,
        comment_id: null,
        reason: 'inappropriate',
        description: 'First report',
        status: 'pending'
      })
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(reportsTable)
      .values({
        reporter_user_id: userId,
        picture_id: null,
        comment_id: commentId,
        reason: 'spam',
        description: 'Second report',
        status: 'reviewed'
      })
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(reportsTable)
      .values({
        reporter_user_id: userId,
        picture_id: pictureId,
        comment_id: null,
        reason: 'harassment',
        description: null,
        status: 'dismissed'
      })
      .execute();

    const results = await getReports();

    expect(results).toHaveLength(3);
    
    // Verify basic report fields
    expect(results[0].id).toBeDefined();
    expect(results[0].reporter_user_id).toEqual(userId);
    expect(results[0].reason).toEqual('harassment');
    expect(results[0].status).toEqual('dismissed');
    expect(results[0].created_at).toBeInstanceOf(Date);
    
    // Verify ordering - newest first
    expect(results[0].created_at >= results[1].created_at).toBe(true);
    expect(results[1].created_at >= results[2].created_at).toBe(true);
    
    // Verify different report types and statuses
    const reasons = results.map(r => r.reason);
    expect(reasons).toContain('inappropriate');
    expect(reasons).toContain('spam');
    expect(reasons).toContain('harassment');
    
    const statuses = results.map(r => r.status);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('reviewed');
    expect(statuses).toContain('dismissed');
  });

  it('should handle reports with null optional fields', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        device_id: 'test-device-1',
        is_admin: false
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create test picture
    const pictureResult = await db.insert(picturesTable)
      .values({
        user_id: userId,
        filename: 'test.jpg',
        original_filename: 'original.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024
      })
      .returning()
      .execute();
    const pictureId = pictureResult[0].id;

    // Create report with minimal fields
    await db.insert(reportsTable)
      .values({
        reporter_user_id: userId,
        picture_id: pictureId,
        comment_id: null,
        reason: 'other',
        description: null,
        status: 'pending'
      })
      .execute();

    const results = await getReports();

    expect(results).toHaveLength(1);
    expect(results[0].description).toBeNull();
    expect(results[0].comment_id).toBeNull();
    expect(results[0].reviewed_at).toBeNull();
    expect(results[0].admin_notes).toBeNull();
    expect(results[0].picture_id).toEqual(pictureId);
    expect(results[0].reason).toEqual('other');
  });
});
