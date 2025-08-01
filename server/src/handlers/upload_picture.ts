
import { db } from '../db';
import { picturesTable, usersTable } from '../db/schema';
import { type UploadPictureInput, type Picture } from '../schema';
import { eq } from 'drizzle-orm';

export const uploadPicture = async (input: UploadPictureInput): Promise<Picture> => {
  try {
    // Verify user exists before inserting picture
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();
    
    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Calculate H3 index from coordinates if available
    let h3Index = null;
    if (input.latitude !== null && input.longitude !== null) {
      // TODO: Use h3-js library to calculate H3 index from lat/lng
      // For now, using placeholder logic
      h3Index = `h3_${input.latitude}_${input.longitude}`;
    }

    // Insert picture record
    const result = await db.insert(picturesTable)
      .values({
        user_id: input.user_id,
        filename: input.filename,
        original_filename: input.original_filename,
        mime_type: input.mime_type,
        file_size: input.file_size,
        width: input.width,
        height: input.height,
        latitude: input.latitude?.toString() || null, // Convert number to string for numeric column
        longitude: input.longitude?.toString() || null, // Convert number to string for numeric column
        h3_index: h3Index,
        exif_data: input.exif_data
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const picture = result[0];
    return {
      ...picture,
      latitude: picture.latitude ? parseFloat(picture.latitude) : null, // Convert string back to number
      longitude: picture.longitude ? parseFloat(picture.longitude) : null // Convert string back to number
    };
  } catch (error) {
    console.error('Picture upload failed:', error);
    throw error;
  }
};
