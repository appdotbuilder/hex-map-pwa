
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, picturesTable } from '../db/schema';
import { getPictureById } from '../handlers/get_picture_by_id';

describe('getPictureById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return picture by ID', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        device_id: 'test-device-123',
        is_admin: false
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create test picture
    const pictureResult = await db.insert(picturesTable)
      .values({
        user_id: user.id,
        filename: 'test.jpg',
        original_filename: 'original_test.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
        width: 800,
        height: 600,
        latitude: '40.7128',
        longitude: '-74.0060',
        h3_index: '872830828ffffff',
        exif_data: '{"camera": "iPhone"}',
        upvotes: 5,
        downvotes: 2,
        comment_count: 3
      })
      .returning()
      .execute();

    const picture = pictureResult[0];

    const result = await getPictureById(picture.id);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(picture.id);
    expect(result!.filename).toEqual('test.jpg');
    expect(result!.original_filename).toEqual('original_test.jpg');
    expect(result!.mime_type).toEqual('image/jpeg');
    expect(result!.file_size).toEqual(1024);
    expect(result!.width).toEqual(800);
    expect(result!.height).toEqual(600);
    expect(result!.latitude).toEqual(40.7128);
    expect(result!.longitude).toEqual(-74.0060);
    expect(typeof result!.latitude).toBe('number');
    expect(typeof result!.longitude).toBe('number');
    expect(result!.h3_index).toEqual('872830828ffffff');
    expect(result!.exif_data).toEqual('{"camera": "iPhone"}');
    expect(result!.upvotes).toEqual(5);
    expect(result!.downvotes).toEqual(2);
    expect(result!.comment_count).toEqual(3);
    expect(result!.is_flagged).toEqual(false);
    expect(result!.upload_timestamp).toBeInstanceOf(Date);
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent picture', async () => {
    const result = await getPictureById(999);
    expect(result).toBeNull();
  });

  it('should return null for flagged picture', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        device_id: 'test-device-456',
        is_admin: false
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create flagged picture
    const pictureResult = await db.insert(picturesTable)
      .values({
        user_id: user.id,
        filename: 'flagged.jpg',
        original_filename: 'flagged_original.jpg',
        mime_type: 'image/jpeg',
        file_size: 2048,
        is_flagged: true,
        flag_reason: 'inappropriate'
      })
      .returning()
      .execute();

    const picture = pictureResult[0];

    const result = await getPictureById(picture.id);
    expect(result).toBeNull();
  });

  it('should handle pictures without coordinates', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        device_id: 'test-device-789',
        is_admin: false
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create picture without coordinates
    const pictureResult = await db.insert(picturesTable)
      .values({
        user_id: user.id,
        filename: 'no_coords.jpg',
        original_filename: 'no_coords_original.jpg',
        mime_type: 'image/jpeg',
        file_size: 512,
        latitude: null,
        longitude: null
      })
      .returning()
      .execute();

    const picture = pictureResult[0];

    const result = await getPictureById(picture.id);

    expect(result).toBeDefined();
    expect(result!.latitude).toBeNull();
    expect(result!.longitude).toBeNull();
  });
});
