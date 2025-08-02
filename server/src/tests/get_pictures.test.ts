
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, picturesTable } from '../db/schema';
import { type GetPicturesInput, type CreateUserInput, type UploadPictureInput } from '../schema';
import { getPictures } from '../handlers/get_pictures';

describe('getPictures', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const createTestUser = async (): Promise<number> => {
    const userInput: CreateUserInput = {
      device_id: 'test-device-123',
      is_admin: false
    };

    const result = await db.insert(usersTable)
      .values({
        device_id: userInput.device_id,
        is_admin: userInput.is_admin || false
      })
      .returning()
      .execute();

    return result[0].id;
  };

  const createTestPicture = async (userId: number, overrides: Partial<UploadPictureInput> = {}) => {
    const pictureInput: UploadPictureInput = {
      user_id: userId,
      filename: 'test-image.jpg',
      original_filename: 'original-test.jpg',
      mime_type: 'image/jpeg',
      file_size: 1024000,
      width: 1920,
      height: 1080,
      latitude: 37.7749,
      longitude: -122.4194,
      exif_data: '{"camera": "iPhone 12"}',
      data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      ...overrides
    };

    const result = await db.insert(picturesTable)
      .values({
        user_id: pictureInput.user_id,
        filename: pictureInput.filename,
        original_filename: pictureInput.original_filename,
        mime_type: pictureInput.mime_type,
        file_size: pictureInput.file_size,
        width: pictureInput.width,
        height: pictureInput.height,
        latitude: pictureInput.latitude?.toString() || null,
        longitude: pictureInput.longitude?.toString() || null,
        h3_index: '8c2a1072b59ffff', // Default H3 index
        exif_data: pictureInput.exif_data
      })
      .returning()
      .execute();

    return result[0];
  };

  it('should return pictures ordered by upload_timestamp (newest first)', async () => {
    const userId = await createTestUser();

    // Create pictures with different timestamps
    const picture1 = await createTestPicture(userId, { filename: 'old-pic.jpg' });
    
    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const picture2 = await createTestPicture(userId, { filename: 'new-pic.jpg' });

    const input: GetPicturesInput = {};
    const results = await getPictures(input);

    expect(results).toHaveLength(2);
    expect(results[0].filename).toEqual('new-pic.jpg'); // Newest first
    expect(results[1].filename).toEqual('old-pic.jpg');
    expect(results[0].upload_timestamp > results[1].upload_timestamp).toBe(true);
  });

  it('should exclude flagged pictures', async () => {
    const userId = await createTestUser();

    // Create normal picture
    await createTestPicture(userId, { filename: 'normal-pic.jpg' });

    // Create flagged picture
    await db.insert(picturesTable)
      .values({
        user_id: userId,
        filename: 'flagged-pic.jpg',
        original_filename: 'flagged.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
        width: 100,
        height: 100,
        latitude: null,
        longitude: null,
        h3_index: null,
        exif_data: null,
        is_flagged: true,
        flag_reason: 'inappropriate'
      })
      .execute();

    const input: GetPicturesInput = {};
    const results = await getPictures(input);

    expect(results).toHaveLength(1);
    expect(results[0].filename).toEqual('normal-pic.jpg');
    expect(results[0].is_flagged).toBe(false);
  });

  it('should filter by h3_index when provided', async () => {
    const userId = await createTestUser();

    // Create picture with specific H3 index
    await db.insert(picturesTable)
      .values({
        user_id: userId,
        filename: 'sf-pic.jpg',
        original_filename: 'sf.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
        width: 100,
        height: 100,
        latitude: null,
        longitude: null,
        h3_index: 'sf_h3_index',
        exif_data: null
      })
      .execute();

    // Create picture with different H3 index
    await db.insert(picturesTable)
      .values({
        user_id: userId,
        filename: 'ny-pic.jpg',
        original_filename: 'ny.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
        width: 100,
        height: 100,
        latitude: null,
        longitude: null,
        h3_index: 'ny_h3_index',
        exif_data: null
      })
      .execute();

    const input: GetPicturesInput = { h3_index: 'sf_h3_index' };
    const results = await getPictures(input);

    expect(results).toHaveLength(1);
    expect(results[0].filename).toEqual('sf-pic.jpg');
    expect(results[0].h3_index).toEqual('sf_h3_index');
  });

  it('should apply pagination correctly', async () => {
    const userId = await createTestUser();

    // Create 5 pictures
    for (let i = 0; i < 5; i++) {
      await createTestPicture(userId, { filename: `pic-${i}.jpg` });
      await new Promise(resolve => setTimeout(resolve, 5)); // Small delay for ordering
    }

    // Test first page
    const firstPageInput: GetPicturesInput = { limit: 2, offset: 0 };
    const firstPage = await getPictures(firstPageInput);

    expect(firstPage).toHaveLength(2);

    // Test second page
    const secondPageInput: GetPicturesInput = { limit: 2, offset: 2 };
    const secondPage = await getPictures(secondPageInput);

    expect(secondPage).toHaveLength(2);

    // Ensure no overlap between pages
    const firstPageIds = firstPage.map(p => p.id);
    const secondPageIds = secondPage.map(p => p.id);
    expect(firstPageIds.some(id => secondPageIds.includes(id))).toBe(false);
  });

  it('should convert numeric fields correctly', async () => {
    const userId = await createTestUser();
    await createTestPicture(userId, {
      latitude: 37.7749,
      longitude: -122.4194
    });

    const input: GetPicturesInput = {};
    const results = await getPictures(input);

    expect(results).toHaveLength(1);
    expect(typeof results[0].latitude).toBe('number');
    expect(typeof results[0].longitude).toBe('number');
    expect(results[0].latitude).toEqual(37.7749);
    expect(results[0].longitude).toEqual(-122.4194);
  });

  it('should handle null coordinates correctly', async () => {
    const userId = await createTestUser();
    await createTestPicture(userId, {
      latitude: null,
      longitude: null
    });

    const input: GetPicturesInput = {};
    const results = await getPictures(input);

    expect(results).toHaveLength(1);
    expect(results[0].latitude).toBeNull();
    expect(results[0].longitude).toBeNull();
  });

  it('should return empty array when no pictures match criteria', async () => {
    const userId = await createTestUser();
    await createTestPicture(userId, { filename: 'test.jpg' });

    const input: GetPicturesInput = { h3_index: 'nonexistent_h3' };
    const results = await getPictures(input);

    expect(results).toHaveLength(0);
  });

  it('should use default pagination values when not provided', async () => {
    const userId = await createTestUser();

    // Create many pictures to test default limit
    for (let i = 0; i < 25; i++) {
      await createTestPicture(userId, { filename: `pic-${i}.jpg` });
    }

    const input: GetPicturesInput = {};
    const results = await getPictures(input);

    // Should use default limit of 20
    expect(results).toHaveLength(20);
  });
});
