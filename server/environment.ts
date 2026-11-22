import { localBucket } from './storage.mjs';

export const env = {
  BUCKET: localBucket(),
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RECOVERY_FROM_EMAIL: process.env.RECOVERY_FROM_EMAIL,
};
