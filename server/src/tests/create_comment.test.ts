
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { commentsTable, picturesTable, usersTable } from '../db/schema';
import { type CreateCommentInput } from '../schema';
import { createComment } from '../handlers/create_comment';
import { eq } from 'drizzle-orm';

// Test data setup
const testUser = {
  device_id: 'test-device-123',
  is_admin: false
};

const testPicture = {
  filename: 'test.jpg',
  original_filename: 'test.jpg',
  mime_type: 'image/jpeg',
  file_size: 1024,
  width: 800,
  height: 600,
  latitude: null,
  longitude: null,
  exif_data: null
};

const testCommentInput: CreateCommentInput = {
  picture_id: 1,
  user_id: 1,
  content: 'This is a test comment'
};

describe('createComment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a comment', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create prerequisite picture
    const pictureResult = await db.insert(picturesTable)
      .values({
        ...testPicture,
        user_id: userResult[0].id
      })
      .returning()
      .execute();

    // Create comment with correct IDs
    const commentInput = {
      ...testCommentInput,
      picture_id: pictureResult[0].id,
      user_id: userResult[0].id
    };

    const result = await createComment(commentInput);

    // Basic field validation
    expect(result.picture_id).toEqual(pictureResult[0].id);
    expect(result.user_id).toEqual(userResult[0].id);
    expect(result.content).toEqual('This is a test comment');
    expect(result.upvotes).toEqual(0);
    expect(result.downvotes).toEqual(0);
    expect(result.is_flagged).toEqual(false);
    expect(result.flag_reason).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save comment to database', async () => {
    // Create prerequisite user and picture
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const pictureResult = await db.insert(picturesTable)
      .values({
        ...testPicture,
        user_id: userResult[0].id
      })
      .returning()
      .execute();

    const commentInput = {
      ...testCommentInput,
      picture_id: pictureResult[0].id,
      user_id: userResult[0].id
    };

    const result = await createComment(commentInput);

    // Verify comment exists in database
    const comments = await db.select()
      .from(commentsTable)
      .where(eq(commentsTable.id, result.id))
      .execute();

    expect(comments).toHaveLength(1);
    expect(comments[0].content).toEqual('This is a test comment');
    expect(comments[0].picture_id).toEqual(pictureResult[0].id);
    expect(comments[0].user_id).toEqual(userResult[0].id);
    expect(comments[0].created_at).toBeInstanceOf(Date);
  });

  it('should update comment_count on picture', async () => {
    // Create prerequisite user and picture
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const pictureResult = await db.insert(picturesTable)
      .values({
        ...testPicture,
        user_id: userResult[0].id
      })
      .returning()
      .execute();

    const commentInput = {
      ...testCommentInput,
      picture_id: pictureResult[0].id,
      user_id: userResult[0].id
    };

    // Verify initial comment count is 0
    expect(pictureResult[0].comment_count).toEqual(0);

    await createComment(commentInput);

    // Check that comment_count was incremented
    const updatedPicture = await db.select()
      .from(picturesTable)
      .where(eq(picturesTable.id, pictureResult[0].id))
      .execute();

    expect(updatedPicture[0].comment_count).toEqual(1);
  });

  it('should throw error for non-existent picture', async () => {
    // Create user but no picture
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const commentInput = {
      ...testCommentInput,
      picture_id: 999, // Non-existent picture ID
      user_id: userResult[0].id
    };

    await expect(createComment(commentInput)).rejects.toThrow(/picture not found/i);
  });

  it('should throw error for non-existent user', async () => {
    // Create picture but reference non-existent user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const pictureResult = await db.insert(picturesTable)
      .values({
        ...testPicture,
        user_id: userResult[0].id
      })
      .returning()
      .execute();

    const commentInput = {
      ...testCommentInput,
      picture_id: pictureResult[0].id,
      user_id: 999 // Non-existent user ID
    };

    await expect(createComment(commentInput)).rejects.toThrow(/user not found/i);
  });
});
