
import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type User } from '../schema';

export async function getUserByDeviceId(deviceId: string): Promise<User | null> {
  try {
    // Find user by device_id
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.device_id, deviceId))
      .execute();

    if (users.length === 0) {
      return null;
    }

    const user = users[0];

    // Update last_active timestamp
    await db.update(usersTable)
      .set({
        last_active: new Date()
      })
      .where(eq(usersTable.id, user.id))
      .execute();

    // Return the user with updated last_active timestamp
    return {
      ...user,
      last_active: new Date()
    };
  } catch (error) {
    console.error('Get user by device ID failed:', error);
    throw error;
  }
}
