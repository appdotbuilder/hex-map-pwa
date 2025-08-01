
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { picturesTable, usersTable } from '../db/schema';
import { type UploadPictureInput } from '../schema';
import { uploadPicture } from '../handlers/upload_picture';
import { eq } from 'drizzle-orm';

describe('uploadPicture', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should upload a picture with all fields', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        device_id: 'test-device-123',
        is_admin: false
      })
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    const testInput: UploadPictureInput = {
      user_id: userId,
      filename: 'stored_image.jpg',
      original_filename: 'my_photo.jpg',
      mime_type: 'image/jpeg',
      file_size: 1024576,
      width: 1920,
      height: 1080,
      latitude: 40.7128,
      longitude: -74.0060,
      exif_data: '{"camera":"Canon EOS 5D","iso":100}'
    };

    const result = await uploadPicture(testInput);

    // Basic field validation
    expect(result.user_id).toEqual(userId);
    expect(result.filename).toEqual('stored_image.jpg');
    expect(result.original_filename).toEqual('my_photo.jpg');
    expect(result.mime_type).toEqual('image/jpeg');
    expect(result.file_size).toEqual(1024576);
    expect(result.width).toEqual(1920);
    expect(result.height).toEqual(1080);
    expect(result.latitude).toEqual(40.7128);
    expect(result.longitude).toEqual(-74.0060);
    expect(result.exif_data).toEqual('{"camera":"Canon EOS 5D","iso":100}');
    expect(result.id).toBeDefined();
    expect(result.upload_timestamp).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.is_flagged).toBe(false);
    expect(result.flag_reason).toBeNull();
    expect(result.upvotes).toEqual(0);
    expect(result.downvotes).toEqual(0);
    expect(result.comment_count).toEqual(0);

    // Verify numeric types are correct
    expect(typeof result.latitude).toBe('number');
    expect(typeof result.longitude).toBe('number');
  });

  it('should upload a picture with nullable coordinates', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        device_id: 'test-device-456',
        is_admin: false
      })
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    const testInput: UploadPictureInput = {
      user_id: userId,
      filename: 'no_location.jpg',
      original_filename: 'indoor_photo.jpg',
      mime_type: 'image/jpeg',
      file_size: 512000,
      width: null,
      height: null,
      latitude: null,
      longitude: null,
      exif_data: null
    };

    const result = await uploadPicture(testInput);

    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
    expect(result.h3_index).toBeNull();
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
    expect(result.exif_data).toBeNull();
  });

  it('should generate h3_index when coordinates are provided', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        device_id: 'test-device-789',
        is_admin: false
      })
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    const testInput: UploadPictureInput = {
      user_id: userId,
      filename: 'gps_photo.jpg',
      original_filename: 'vacation.jpg',
      mime_type: 'image/jpeg',
      file_size: 2048000,
      width: 4000,
      height: 3000,
      latitude: 51.5074,
      longitude: -0.1278,
      exif_data: '{"gps":true}'
    };

    const result = await uploadPicture(testInput);

    expect(result.h3_index).toBeDefined();
    expect(result.h3_index).toContain('h3_51.5074_-0.1278');
  });

  it('should save picture to database', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        device_id: 'test-device-db',
        is_admin: false
      })
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    const testInput: UploadPictureInput = {
      user_id: userId,
      filename: 'db_test.jpg',
      original_filename: 'test.jpg',
      mime_type: 'image/jpeg',
      file_size: 100000,
      width: 800,
      height: 600,
      latitude: 37.7749,
      longitude: -122.4194,
      exif_data: '{"test":true}'
    };

    const result = await uploadPicture(testInput);

    // Query database to verify picture was saved
    const pictures = await db.select()
      .from(picturesTable)
      .where(eq(picturesTable.id, result.id))
      .execute();

    expect(pictures).toHaveLength(1);
    const savedPicture = pictures[0];
    expect(savedPicture.filename).toEqual('db_test.jpg');
    expect(savedPicture.user_id).toEqual(userId);
    expect(parseFloat(savedPicture.latitude!)).toEqual(37.7749);
    expect(parseFloat(savedPicture.longitude!)).toEqual(-122.4194);
    expect(savedPicture.upload_timestamp).toBeInstanceOf(Date);
    expect(savedPicture.created_at).toBeInstanceOf(Date);
  });

  it('should throw error when user does not exist', async () => {
    const testInput: UploadPictureInput = {
      user_id: 99999, // Non-existent user ID
      filename: 'error_test.jpg',
      original_filename: 'test.jpg',
      mime_type: 'image/jpeg',
      file_size: 100000,
      width: 800,
      height: 600,
      latitude: null,
      longitude: null,
      exif_data: null
    };

    await expect(uploadPicture(testInput)).rejects.toThrow(/user not found/i);
  });
});
