
import { db } from '../db';
import { picturesTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type Picture } from '../schema';

export async function getPictureById(pictureId: number): Promise<Picture | null> {
  try {
    const results = await db.select()
      .from(picturesTable)
      .where(eq(picturesTable.id, pictureId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const picture = results[0];

    // Don't return flagged pictures
    if (picture.is_flagged) {
      return null;
    }

    // Convert numeric fields back to numbers
    return {
      ...picture,
      latitude: picture.latitude ? parseFloat(picture.latitude) : null,
      longitude: picture.longitude ? parseFloat(picture.longitude) : null
    };
  } catch (error) {
    console.error('Failed to get picture by ID:', error);
    throw error;
  }
}
