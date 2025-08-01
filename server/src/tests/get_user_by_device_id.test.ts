
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { getUserByDeviceId } from '../handlers/get_user_by_device_id';
import { eq } from 'drizzle-orm';

describe('getUserByDeviceId', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user when device_id exists', async () => {
    // Create test user
    const testUser = await db.insert(usersTable)
      .values({
        device_id: 'test-device-123',
        is_admin: false
      })
      .returning()
      .execute();

    const createdUser = testUser[0];

    // Get user by device_id
    const result = await getUserByDeviceId('test-device-123');

    // Verify user is returned
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdUser.id);
    expect(result!.device_id).toEqual('test-device-123');
    expect(result!.is_admin).toEqual(false);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.last_active).toBeInstanceOf(Date);
  });

  it('should return null when device_id does not exist', async () => {
    const result = await getUserByDeviceId('non-existent-device');

    expect(result).toBeNull();
  });

  it('should update last_active timestamp when user is found', async () => {
    // Create test user with specific timestamps
    const originalDate = new Date('2023-01-01T10:00:00Z');
    const testUser = await db.insert(usersTable)
      .values({
        device_id: 'test-device-456',
        is_admin: true,
        created_at: originalDate,
        last_active: originalDate
      })
      .returning()
      .execute();

    const createdUser = testUser[0];

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    // Get user by device_id
    const result = await getUserByDeviceId('test-device-456');

    // Verify last_active was updated
    expect(result).not.toBeNull();
    expect(result!.last_active.getTime()).toBeGreaterThan(originalDate.getTime());

    // Verify database was updated
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, createdUser.id))
      .execute();

    expect(updatedUsers).toHaveLength(1);
    expect(updatedUsers[0].last_active.getTime()).toBeGreaterThan(originalDate.getTime());
  });

  it('should handle admin user correctly', async () => {
    // Create admin user
    await db.insert(usersTable)
      .values({
        device_id: 'admin-device-789',
        is_admin: true
      })
      .returning()
      .execute();

    const result = await getUserByDeviceId('admin-device-789');

    expect(result).not.toBeNull();
    expect(result!.device_id).toEqual('admin-device-789');
    expect(result!.is_admin).toEqual(true);
  });
});
