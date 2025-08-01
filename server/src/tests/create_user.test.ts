
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test input
const testInput: CreateUserInput = {
  device_id: 'test-device-123',
  is_admin: false
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a new user', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.device_id).toEqual('test-device-123');
    expect(result.is_admin).toEqual(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.last_active).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].device_id).toEqual('test-device-123');
    expect(users[0].is_admin).toEqual(false);
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].last_active).toBeInstanceOf(Date);
  });

  it('should return existing user if device_id already exists', async () => {
    // Create user first time
    const firstResult = await createUser(testInput);
    
    // Wait a small amount to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Try to create user with same device_id
    const secondResult = await createUser(testInput);

    // Should return the same user ID
    expect(secondResult.id).toEqual(firstResult.id);
    expect(secondResult.device_id).toEqual(firstResult.device_id);
    expect(secondResult.is_admin).toEqual(firstResult.is_admin);
    
    // But last_active should be updated
    expect(secondResult.last_active).not.toEqual(firstResult.last_active);
    expect(secondResult.last_active > firstResult.last_active).toBe(true);
  });

  it('should create admin user when is_admin is true', async () => {
    const adminInput: CreateUserInput = {
      device_id: 'admin-device-456',
      is_admin: true
    };

    const result = await createUser(adminInput);

    expect(result.device_id).toEqual('admin-device-456');
    expect(result.is_admin).toEqual(true);
  });

  it('should default is_admin to false when not provided', async () => {
    const inputWithoutAdmin: CreateUserInput = {
      device_id: 'regular-device-789'
    };

    const result = await createUser(inputWithoutAdmin);

    expect(result.device_id).toEqual('regular-device-789');
    expect(result.is_admin).toEqual(false);
  });

  it('should only have one user per device_id in database', async () => {
    // Create user multiple times with same device_id
    await createUser(testInput);
    await createUser(testInput);
    await createUser(testInput);

    // Verify only one user exists in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.device_id, testInput.device_id))
      .execute();

    expect(users).toHaveLength(1);
  });
});
