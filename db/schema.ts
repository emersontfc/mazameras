import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const entries = sqliteTable('entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  author: text('author').notNull(),
  email: text('email'),
  chapter: text('chapter').notNull(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  visibility: text('visibility').notNull().default('book'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [uniqueIndex('entry_user_question').on(table.userId, table.question)]);

export const editorialPages = sqliteTable('editorial_pages', {
  key: text('key').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  body: text('body').notNull().default(''),
  status: text('status').notNull().default('draft'),
  updatedAt: integer('updated_at').notNull(),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  role: text('role').notNull().default('author'),
  createdAt: integer('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  accountId: text('account_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

export const loginAttempts = sqliteTable('login_attempts', {
  username: text('username').primaryKey(),
  count: integer('count').notNull(),
  lastAttempt: integer('last_attempt').notNull(),
});

export const photos = sqliteTable('photos', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  question: text('question').notNull(),
  objectKey: text('object_key').notNull(),
  contentType: text('content_type').notNull(),
  caption: text('caption').notNull().default(''),
  people: text('people').notNull().default(''),
  publicationConsent: integer('publication_consent', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
}, (table) => [uniqueIndex('photo_user_question').on(table.userId, table.question)]);

export const accountEmails = sqliteTable('account_emails', {
  accountId: text('account_id').primaryKey(),
  email: text('email').notNull().unique(),
});
export const passwordResets = sqliteTable('password_resets', {
  tokenHash: text('token_hash').primaryKey(),
  accountId: text('account_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

export const avatars = sqliteTable('avatars', {
  accountId: text('account_id').primaryKey(),
  objectKey: text('object_key').notNull(),
  contentType: text('content_type').notNull(),
});
