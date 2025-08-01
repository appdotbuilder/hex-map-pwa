
import { z } from 'zod';

// User schema - minimal anonymous user tracking
export const userSchema = z.object({
  id: z.number(),
  device_id: z.string(), // Anonymous device identifier
  is_admin: z.boolean(),
  created_at: z.coerce.date(),
  last_active: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Picture schema
export const pictureSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  filename: z.string(),
  original_filename: z.string(),
  mime_type: z.string(),
  file_size: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  h3_index: z.string().nullable(), // H3 hexagon identifier
  exif_data: z.string().nullable(), // JSON string of EXIF data
  upload_timestamp: z.coerce.date(),
  is_flagged: z.boolean(),
  flag_reason: z.string().nullable(),
  upvotes: z.number(),
  downvotes: z.number(),
  comment_count: z.number(),
  created_at: z.coerce.date()
});

export type Picture = z.infer<typeof pictureSchema>;

// Comment schema
export const commentSchema = z.object({
  id: z.number(),
  picture_id: z.number(),
  user_id: z.number(),
  content: z.string(),
  upvotes: z.number(),
  downvotes: z.number(),
  is_flagged: z.boolean(),
  flag_reason: z.string().nullable(),
  created_at: z.coerce.date()
});

export type Comment = z.infer<typeof commentSchema>;

// Vote schema
export const voteSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  picture_id: z.number().nullable(),
  comment_id: z.number().nullable(),
  vote_type: z.enum(['upvote', 'downvote']),
  created_at: z.coerce.date()
});

export type Vote = z.infer<typeof voteSchema>;

// Report schema
export const reportSchema = z.object({
  id: z.number(),
  reporter_user_id: z.number(),
  picture_id: z.number().nullable(),
  comment_id: z.number().nullable(),
  reason: z.enum(['inappropriate', 'spam', 'harassment', 'copyright', 'other']),
  description: z.string().nullable(),
  status: z.enum(['pending', 'reviewed', 'dismissed']),
  admin_notes: z.string().nullable(),
  created_at: z.coerce.date(),
  reviewed_at: z.coerce.date().nullable()
});

export type Report = z.infer<typeof reportSchema>;

// Input schemas for creating entities
export const createUserInputSchema = z.object({
  device_id: z.string().min(1),
  is_admin: z.boolean().optional()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const uploadPictureInputSchema = z.object({
  user_id: z.number(),
  filename: z.string(),
  original_filename: z.string(),
  mime_type: z.string(),
  file_size: z.number().positive(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  exif_data: z.string().nullable()
});

export type UploadPictureInput = z.infer<typeof uploadPictureInputSchema>;

export const createCommentInputSchema = z.object({
  picture_id: z.number(),
  user_id: z.number(),
  content: z.string().min(1).max(1000)
});

export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;

export const createVoteInputSchema = z.object({
  user_id: z.number(),
  picture_id: z.number().nullable(),
  comment_id: z.number().nullable(),
  vote_type: z.enum(['upvote', 'downvote'])
});

export type CreateVoteInput = z.infer<typeof createVoteInputSchema>;

export const createReportInputSchema = z.object({
  reporter_user_id: z.number(),
  picture_id: z.number().nullable(),
  comment_id: z.number().nullable(),
  reason: z.enum(['inappropriate', 'spam', 'harassment', 'copyright', 'other']),
  description: z.string().nullable()
});

export type CreateReportInput = z.infer<typeof createReportInputSchema>;

// Query schemas
export const getPicturesInputSchema = z.object({
  h3_index: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional()
});

export type GetPicturesInput = z.infer<typeof getPicturesInputSchema>;

export const getCommentsInputSchema = z.object({
  picture_id: z.number(),
  limit: z.number().int().min(1).max(50).optional(),
  offset: z.number().int().min(0).optional()
});

export type GetCommentsInput = z.infer<typeof getCommentsInputSchema>;

// Admin schemas
export const updateReportStatusInputSchema = z.object({
  report_id: z.number(),
  status: z.enum(['reviewed', 'dismissed']),
  admin_notes: z.string().nullable()
});

export type UpdateReportStatusInput = z.infer<typeof updateReportStatusInputSchema>;
