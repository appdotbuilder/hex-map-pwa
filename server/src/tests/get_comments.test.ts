
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, picturesTable, commentsTable } from '../db/schema';
import { type GetCommentsInput } from '../schema';
import { getComments } from '../handlers/get_comments';

// Test setup data
const testUser = {
  device_id: 'test-device-123',
  is_admin: false
};

const testPicture = {
  user_id: 1, // Will be set after user creation
  filename: 'test-image.jpg',
  original_filename: 'original-test.jpg',
  mime_type: 'image/jpeg',
  file_size: 1024,
  width: 800,
  height: 600,
  latitude: null,
  longitude: null,
  h3_index: null,
  exif_data: null
};

const testComment1 = {
  picture_id: 1, // Will be set after picture creation
  user_id: 1,
  content: 'First test comment',
  upvotes: 5,
  downvotes: 1,
  is_flagged: false,
  flag_reason: null
};

const testComment2 = {
  picture_id: 1,
  user_id: 1,
  content: 'Second test comment',
  upvotes: 2,
  downvotes: 0,
  is_flagged: false,
  flag_reason: null
};

const flaggedComment = {
  picture_id: 1,
  user_id: 1,
  content: 'Inappropriate content',
  upvotes: 0,
  downvotes: 0,
  is_flagged: true,
  flag_reason: 'inappropriate'
};

describe('getComments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return comments for a picture', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const pictureResult = await db.insert(picturesTable)
      .values({ ...testPicture, user_id: userResult[0].id })
      .returning()
      .execute();

    // Create comments one by one to ensure different timestamps
    const comment1Result = await db.insert(commentsTable)
      .values({ ...testComment1, picture_id: pictureResult[0].id, user_id: userResult[0].id })
      .returning()
      .execute();

    // Add small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    const comment2Result = await db.insert(commentsTable)
      .values({ ...testComment2, picture_id: pictureResult[0].id, user_id: userResult[0].id })
      .returning()
      .execute();

    const input: GetCommentsInput = {
      picture_id: pictureResult[0].id
    };

    const result = await getComments(input);

    expect(result).toHaveLength(2);
    // Verify we get both comments but don't assume order since timestamps might be same
    const contents = result.map(c => c.content).sort();
    expect(contents).toEqual(['First test comment', 'Second test comment']);
    expect(result[0].picture_id).toEqual(pictureResult[0].id);
    expect(result[0].user_id).toEqual(userResult[0].id);
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should exclude flagged comments', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const pictureResult = await db.insert(picturesTable)
      .values({ ...testPicture, user_id: userResult[0].id })
      .returning()
      .execute();

    // Create comments including a flagged one
    await db.insert(commentsTable)
      .values([
        { ...testComment1, picture_id: pictureResult[0].id, user_id: userResult[0].id },
        { ...flaggedComment, picture_id: pictureResult[0].id, user_id: userResult[0].id }
      ])
      .execute();

    const input: GetCommentsInput = {
      picture_id: pictureResult[0].id
    };

    const result = await getComments(input);

    expect(result).toHaveLength(1);
    expect(result[0].content).toEqual('First test comment');
    expect(result[0].is_flagged).toEqual(false);
  });

  it('should apply pagination correctly', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const pictureResult = await db.insert(picturesTable)
      .values({ ...testPicture, user_id: userResult[0].id })
      .returning()
      .execute();

    // Create multiple comments with explicit timestamps to ensure ordering
    const baseTime = new Date();
    const time1 = new Date(baseTime.getTime() - 2000); // 2 seconds ago
    const time2 = new Date(baseTime.getTime() - 1000); // 1 second ago
    const time3 = new Date(baseTime.getTime()); // now

    await db.insert(commentsTable)
      .values([
        { ...testComment1, picture_id: pictureResult[0].id, user_id: userResult[0].id, content: 'Comment 1', created_at: time1 },
        { ...testComment2, picture_id: pictureResult[0].id, user_id: userResult[0].id, content: 'Comment 2', created_at: time2 },
        { ...testComment1, picture_id: pictureResult[0].id, user_id: userResult[0].id, content: 'Comment 3', created_at: time3 }
      ])
      .execute();

    const input: GetCommentsInput = {
      picture_id: pictureResult[0].id,
      limit: 2,
      offset: 1
    };

    const result = await getComments(input);

    expect(result).toHaveLength(2);
    // With desc ordering and offset 1, we skip the newest (Comment 3) and get Comment 2, Comment 1
    expect(result[0].content).toEqual('Comment 2');
    expect(result[1].content).toEqual('Comment 1');
  });

  it('should return empty array for non-existent picture', async () => {
    const input: GetCommentsInput = {
      picture_id: 999
    };

    const result = await getComments(input);

    expect(result).toHaveLength(0);
  });

  it('should order comments by created_at descending', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const pictureResult = await db.insert(picturesTable)
      .values({ ...testPicture, user_id: userResult[0].id })
      .returning()
      .execute();

    // Create comments with explicit timestamps
    const now = new Date();
    const earlier = new Date(now.getTime() - 60000); // 1 minute earlier

    await db.insert(commentsTable)
      .values([
        { 
          ...testComment1, 
          picture_id: pictureResult[0].id, 
          user_id: userResult[0].id, 
          content: 'Older comment',
          created_at: earlier
        },
        { 
          ...testComment2, 
          picture_id: pictureResult[0].id, 
          user_id: userResult[0].id, 
          content: 'Newer comment',
          created_at: now
        }
      ])
      .execute();

    const input: GetCommentsInput = {
      picture_id: pictureResult[0].id
    };

    const result = await getComments(input);

    expect(result).toHaveLength(2);
    expect(result[0].content).toEqual('Newer comment');
    expect(result[1].content).toEqual('Older comment');
    expect(result[0].created_at >= result[1].created_at).toBe(true);
  });
});
