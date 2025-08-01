
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, picturesTable, commentsTable, votesTable } from '../db/schema';
import { type CreateVoteInput } from '../schema';
import { createVote } from '../handlers/create_vote';
import { eq } from 'drizzle-orm';

describe('createVote', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testPictureId: number;
  let testCommentId: number;

  beforeEach(async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({ device_id: 'test-device-123' })
      .returning()
      .execute();
    testUserId = user[0].id;

    // Create test picture
    const picture = await db.insert(picturesTable)
      .values({
        user_id: testUserId,
        filename: 'test.jpg',
        original_filename: 'test.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024
      })
      .returning()
      .execute();
    testPictureId = picture[0].id;

    // Create test comment
    const comment = await db.insert(commentsTable)
      .values({
        picture_id: testPictureId,
        user_id: testUserId,
        content: 'Test comment'
      })
      .returning()
      .execute();
    testCommentId = comment[0].id;
  });

  it('should create a new vote on picture', async () => {
    const input: CreateVoteInput = {
      user_id: testUserId,
      picture_id: testPictureId,
      comment_id: null,
      vote_type: 'upvote'
    };

    const result = await createVote(input);

    expect(result.user_id).toEqual(testUserId);
    expect(result.picture_id).toEqual(testPictureId);
    expect(result.comment_id).toBeNull();
    expect(result.vote_type).toEqual('upvote');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a new vote on comment', async () => {
    const input: CreateVoteInput = {
      user_id: testUserId,
      picture_id: null,
      comment_id: testCommentId,
      vote_type: 'downvote'
    };

    const result = await createVote(input);

    expect(result.user_id).toEqual(testUserId);
    expect(result.picture_id).toBeNull();
    expect(result.comment_id).toEqual(testCommentId);
    expect(result.vote_type).toEqual('downvote');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update existing vote when user votes again', async () => {
    // Create initial upvote
    const initialInput: CreateVoteInput = {
      user_id: testUserId,
      picture_id: testPictureId,
      comment_id: null,
      vote_type: 'upvote'
    };

    const firstVote = await createVote(initialInput);

    // Change to downvote
    const updateInput: CreateVoteInput = {
      user_id: testUserId,
      picture_id: testPictureId,
      comment_id: null,
      vote_type: 'downvote'
    };

    const updatedVote = await createVote(updateInput);

    // Should be same vote record, just updated
    expect(updatedVote.id).toEqual(firstVote.id);
    expect(updatedVote.vote_type).toEqual('downvote');
    expect(updatedVote.created_at).not.toEqual(firstVote.created_at);

    // Verify only one vote exists in database
    const allVotes = await db.select()
      .from(votesTable)
      .where(eq(votesTable.user_id, testUserId))
      .execute();

    expect(allVotes).toHaveLength(1);
    expect(allVotes[0].vote_type).toEqual('downvote');
  });

  it('should update picture vote counts', async () => {
    const input: CreateVoteInput = {
      user_id: testUserId,
      picture_id: testPictureId,
      comment_id: null,
      vote_type: 'upvote'
    };

    await createVote(input);

    // Check picture vote counts were updated
    const picture = await db.select()
      .from(picturesTable)
      .where(eq(picturesTable.id, testPictureId))
      .execute();

    expect(picture[0].upvotes).toEqual(1);
    expect(picture[0].downvotes).toEqual(0);
  });

  it('should update comment vote counts', async () => {
    const input: CreateVoteInput = {
      user_id: testUserId,
      picture_id: null,
      comment_id: testCommentId,
      vote_type: 'downvote'
    };

    await createVote(input);

    // Check comment vote counts were updated
    const comment = await db.select()
      .from(commentsTable)
      .where(eq(commentsTable.id, testCommentId))
      .execute();

    expect(comment[0].upvotes).toEqual(0);
    expect(comment[0].downvotes).toEqual(1);
  });

  it('should recalculate counts correctly when vote is changed', async () => {
    // Create upvote first
    const upvoteInput: CreateVoteInput = {
      user_id: testUserId,
      picture_id: testPictureId,
      comment_id: null,
      vote_type: 'upvote'
    };

    await createVote(upvoteInput);

    // Change to downvote
    const downvoteInput: CreateVoteInput = {
      user_id: testUserId,
      picture_id: testPictureId,
      comment_id: null,
      vote_type: 'downvote'
    };

    await createVote(downvoteInput);

    // Check final counts
    const picture = await db.select()
      .from(picturesTable)
      .where(eq(picturesTable.id, testPictureId))
      .execute();

    expect(picture[0].upvotes).toEqual(0);
    expect(picture[0].downvotes).toEqual(1);
  });

  it('should throw error when neither picture_id nor comment_id provided', async () => {
    const input: CreateVoteInput = {
      user_id: testUserId,
      picture_id: null,
      comment_id: null,
      vote_type: 'upvote'
    };

    await expect(createVote(input)).rejects.toThrow(/either picture_id or comment_id must be provided/i);
  });

  it('should throw error when both picture_id and comment_id provided', async () => {
    const input: CreateVoteInput = {
      user_id: testUserId,
      picture_id: testPictureId,
      comment_id: testCommentId,
      vote_type: 'upvote'
    };

    await expect(createVote(input)).rejects.toThrow(/cannot vote on both picture and comment/i);
  });

  it('should handle multiple users voting on same picture', async () => {
    // Create second user
    const secondUser = await db.insert(usersTable)
      .values({ device_id: 'test-device-456' })
      .returning()
      .execute();

    // First user upvotes
    await createVote({
      user_id: testUserId,
      picture_id: testPictureId,
      comment_id: null,
      vote_type: 'upvote'
    });

    // Second user downvotes
    await createVote({
      user_id: secondUser[0].id,
      picture_id: testPictureId,
      comment_id: null,
      vote_type: 'downvote'
    });

    // Check final counts
    const picture = await db.select()
      .from(picturesTable)
      .where(eq(picturesTable.id, testPictureId))
      .execute();

    expect(picture[0].upvotes).toEqual(1);
    expect(picture[0].downvotes).toEqual(1);

    // Verify two separate vote records exist
    const allVotes = await db.select()
      .from(votesTable)
      .where(eq(votesTable.picture_id, testPictureId))
      .execute();

    expect(allVotes).toHaveLength(2);
  });
});
