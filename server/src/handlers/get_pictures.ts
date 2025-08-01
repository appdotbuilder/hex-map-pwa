
import { db } from '../db';
import { picturesTable } from '../db/schema';
import { type GetPicturesInput, type Picture } from '../schema';
import { eq, desc, and, SQL } from 'drizzle-orm';

export async function getPictures(input: GetPicturesInput): Promise<Picture[]> {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];
    
    // Exclude flagged pictures from public view
    conditions.push(eq(picturesTable.is_flagged, false));
    
    // Apply H3 index filter if provided
    if (input.h3_index) {
      conditions.push(eq(picturesTable.h3_index, input.h3_index));
    }

    // Apply pagination with defaults
    const limit = input.limit || 20;
    const offset = input.offset || 0;

    // Build and execute query
    const results = await db.select()
      .from(picturesTable)
      .where(and(...conditions))
      .orderBy(desc(picturesTable.upload_timestamp))
      .limit(limit)
      .offset(offset)
      .execute();

    // Convert numeric fields back to numbers
    return results.map(picture => ({
      ...picture,
      latitude: picture.latitude ? parseFloat(picture.latitude) : null,
      longitude: picture.longitude ? parseFloat(picture.longitude) : null
    }));
  } catch (error) {
    console.error('Failed to get pictures:', error);
    throw error;
  }
}
