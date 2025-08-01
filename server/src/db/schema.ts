
import { serial, text, pgTable, timestamp, integer, boolean, numeric, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const voteTypeEnum = pgEnum('vote_type', ['upvote', 'downvote']);
export const reportReasonEnum = pgEnum('report_reason', ['inappropriate', 'spam', 'harassment', 'copyright', 'other']);
export const reportStatusEnum = pgEnum('report_status', ['pending', 'reviewed', 'dismissed']);

// Users table - minimal anonymous user tracking
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  device_id: text('device_id').notNull().unique(), // Anonymous device identifier
  is_admin: boolean('is_admin').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  last_active: timestamp('last_active').defaultNow().notNull()
});

// Pictures table
export const picturesTable = pgTable('pictures', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  filename: text('filename').notNull(), // Stored filename
  original_filename: text('original_filename').notNull(), // Original uploaded filename
  mime_type: text('mime_type').notNull(),
  file_size: integer('file_size').notNull(),
  width: integer('width'), // Nullable - may not be available
  height: integer('height'), // Nullable - may not be available
  latitude: numeric('latitude', { precision: 10, scale: 8 }), // High precision for GPS coordinates
  longitude: numeric('longitude', { precision: 11, scale: 8 }), // High precision for GPS coordinates
  h3_index: text('h3_index'), // H3 hexagon identifier for mapping
  exif_data: text('exif_data'), // JSON string of EXIF data
  upload_timestamp: timestamp('upload_timestamp').defaultNow().notNull(),
  is_flagged: boolean('is_flagged').notNull().default(false),
  flag_reason: text('flag_reason'), // Reason for flagging
  upvotes: integer('upvotes').notNull().default(0),
  downvotes: integer('downvotes').notNull().default(0),
  comment_count: integer('comment_count').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Comments table
export const commentsTable = pgTable('comments', {
  id: serial('id').primaryKey(),
  picture_id: integer('picture_id').notNull().references(() => picturesTable.id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  content: text('content').notNull(),
  upvotes: integer('upvotes').notNull().default(0),
  downvotes: integer('downvotes').notNull().default(0),
  is_flagged: boolean('is_flagged').notNull().default(false),
  flag_reason: text('flag_reason'), // Reason for flagging
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Votes table - tracks upvotes/downvotes for pictures and comments
export const votesTable = pgTable('votes', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  picture_id: integer('picture_id').references(() => picturesTable.id, { onDelete: 'cascade' }),
  comment_id: integer('comment_id').references(() => commentsTable.id, { onDelete: 'cascade' }),
  vote_type: voteTypeEnum('vote_type').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Reports table - for flagging inappropriate content
export const reportsTable = pgTable('reports', {
  id: serial('id').primaryKey(),
  reporter_user_id: integer('reporter_user_id').notNull().references(() => usersTable.id),
  picture_id: integer('picture_id').references(() => picturesTable.id, { onDelete: 'cascade' }),
  comment_id: integer('comment_id').references(() => commentsTable.id, { onDelete: 'cascade' }),
  reason: reportReasonEnum('reason').notNull(),
  description: text('description'), // Optional additional description
  status: reportStatusEnum('status').notNull().default('pending'),
  admin_notes: text('admin_notes'), // Admin review notes
  created_at: timestamp('created_at').defaultNow().notNull(),
  reviewed_at: timestamp('reviewed_at') // When admin reviewed the report
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  pictures: many(picturesTable),
  comments: many(commentsTable),
  votes: many(votesTable),
  reports: many(reportsTable)
}));

export const picturesRelations = relations(picturesTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [picturesTable.user_id],
    references: [usersTable.id]
  }),
  comments: many(commentsTable),
  votes: many(votesTable),
  reports: many(reportsTable)
}));

export const commentsRelations = relations(commentsTable, ({ one, many }) => ({
  picture: one(picturesTable, {
    fields: [commentsTable.picture_id],
    references: [picturesTable.id]
  }),
  user: one(usersTable, {
    fields: [commentsTable.user_id],
    references: [usersTable.id]
  }),
  votes: many(votesTable),
  reports: many(reportsTable)
}));

export const votesRelations = relations(votesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [votesTable.user_id],
    references: [usersTable.id]
  }),
  picture: one(picturesTable, {
    fields: [votesTable.picture_id],
    references: [picturesTable.id]
  }),
  comment: one(commentsTable, {
    fields: [votesTable.comment_id],
    references: [commentsTable.id]
  })
}));

export const reportsRelations = relations(reportsTable, ({ one }) => ({
  reporter: one(usersTable, {
    fields: [reportsTable.reporter_user_id],
    references: [usersTable.id]
  }),
  picture: one(picturesTable, {
    fields: [reportsTable.picture_id],
    references: [picturesTable.id]
  }),
  comment: one(commentsTable, {
    fields: [reportsTable.comment_id],
    references: [commentsTable.id]
  })
}));

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  pictures: picturesTable,
  comments: commentsTable,
  votes: votesTable,
  reports: reportsTable
};
