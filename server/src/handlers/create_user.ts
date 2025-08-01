
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Check if user with device_id already exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.device_id, input.device_id))
      .execute();

    if (existingUsers.length > 0) {
      // Update last_active timestamp for existing user
      const updatedUsers = await db.update(usersTable)
        .set({ last_active: new Date() })
        .where(eq(usersTable.device_id, input.device_id))
        .returning()
        .execute();

      return updatedUsers[0];
    }

    // Create new user record
    const result = await db.insert(usersTable)
      .values({
        device_id: input.device_id,
        is_admin: input.is_admin || false
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};
