
import { db } from '../db';
import { votesTable, picturesTable, commentsTable } from '../db/schema';
import { type CreateVoteInput, type Vote } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createVote(input: CreateVoteInput): Promise<Vote> {
  try {
    // Validate that exactly one target is provided
    if (!input.picture_id && !input.comment_id) {
      throw new Error('Either picture_id or comment_id must be provided');
    }
    
    if (input.picture_id && input.comment_id) {
      throw new Error('Cannot vote on both picture and comment simultaneously');
    }

    // Check if user has already voted on this target
    const conditions = [eq(votesTable.user_id, input.user_id)];
    
    if (input.picture_id) {
      conditions.push(eq(votesTable.picture_id, input.picture_id));
    } else {
      conditions.push(eq(votesTable.comment_id, input.comment_id!));
    }

    const existingVote = await db.select()
      .from(votesTable)
      .where(and(...conditions))
      .execute();

    let voteResult: Vote;

    if (existingVote.length > 0) {
      // Update existing vote
      const updated = await db.update(votesTable)
        .set({ 
          vote_type: input.vote_type,
          created_at: new Date() // Update timestamp for vote change
        })
        .where(eq(votesTable.id, existingVote[0].id))
        .returning()
        .execute();

      voteResult = updated[0];
    } else {
      // Create new vote
      const created = await db.insert(votesTable)
        .values({
          user_id: input.user_id,
          picture_id: input.picture_id,
          comment_id: input.comment_id,
          vote_type: input.vote_type
        })
        .returning()
        .execute();

      voteResult = created[0];
    }

    // Update vote counts on target entity
    if (input.picture_id) {
      // Recalculate picture vote counts
      const pictureVotes = await db.select()
        .from(votesTable)
        .where(eq(votesTable.picture_id, input.picture_id))
        .execute();

      const upvotes = pictureVotes.filter(v => v.vote_type === 'upvote').length;
      const downvotes = pictureVotes.filter(v => v.vote_type === 'downvote').length;

      await db.update(picturesTable)
        .set({ upvotes, downvotes })
        .where(eq(picturesTable.id, input.picture_id))
        .execute();
    } else {
      // Recalculate comment vote counts
      const commentVotes = await db.select()
        .from(votesTable)
        .where(eq(votesTable.comment_id, input.comment_id!))
        .execute();

      const upvotes = commentVotes.filter(v => v.vote_type === 'upvote').length;
      const downvotes = commentVotes.filter(v => v.vote_type === 'downvote').length;

      await db.update(commentsTable)
        .set({ upvotes, downvotes })
        .where(eq(commentsTable.id, input.comment_id!))
        .execute();
    }

    return voteResult;
  } catch (error) {
    console.error('Vote creation failed:', error);
    throw error;
  }
}
