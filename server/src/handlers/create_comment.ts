
import { db } from '../db';
import { commentsTable, picturesTable, usersTable } from '../db/schema';
import { type CreateCommentInput, type Comment } from '../schema';
import { eq } from 'drizzle-orm';

export const createComment = async (input: CreateCommentInput): Promise<Comment> => {
  try {
    // Verify that the picture exists
    const picture = await db.select()
      .from(picturesTable)
      .where(eq(picturesTable.id, input.picture_id))
      .execute();

    if (picture.length === 0) {
      throw new Error('Picture not found');
    }

    // Verify that the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Insert comment record
    const result = await db.insert(commentsTable)
      .values({
        picture_id: input.picture_id,
        user_id: input.user_id,
        content: input.content
      })
      .returning()
      .execute();

    // Update comment_count on the associated picture
    await db.update(picturesTable)
      .set({
        comment_count: picture[0].comment_count + 1
      })
      .where(eq(picturesTable.id, input.picture_id))
      .execute();

    const comment = result[0];
    return comment;
  } catch (error) {
    console.error('Comment creation failed:', error);
    throw error;
  }
};
