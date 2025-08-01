
import { db } from '../db';
import { commentsTable } from '../db/schema';
import { type GetCommentsInput, type Comment } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getComments(input: GetCommentsInput): Promise<Comment[]> {
  try {
    // Build query step by step without reassigning
    const limit = input.limit || 20; // Default limit
    const offset = input.offset || 0; // Default offset
    
    const results = await db.select()
      .from(commentsTable)
      .where(eq(commentsTable.picture_id, input.picture_id))
      .orderBy(desc(commentsTable.created_at))
      .limit(limit)
      .offset(offset)
      .execute();

    // Filter out flagged comments and return properly typed results
    return results
      .filter(comment => !comment.is_flagged)
      .map(comment => ({
        ...comment,
        created_at: comment.created_at
      }));
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    throw error;
  }
}
