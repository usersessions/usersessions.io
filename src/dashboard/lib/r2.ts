import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// R2 environment variables — set in .env / Cloudflare Pages:
// R2_ACCOUNT_ID       — 32-char hex, your Cloudflare account identifier
// R2_ACCESS_KEY_ID    — token Access Key ID
// R2_SECRET_ACCESS_KEY — token Secret Access Key
// R2_BUCKET_NAME      — e.g. usersessions-replays
// R2_ENDPOINT         — jurisdiction-specific S3 endpoint, e.g.:
//   Default: https://<account_id>.r2.cloudflarestorage.com
//   EU:      https://<account_id>.eu.r2.cloudflarestorage.com
//   US:      https://<account_id>.us.r2.cloudflarestorage.com

const accountId = process.env.R2_ACCOUNT_ID || ''
const accessKeyId = process.env.R2_ACCESS_KEY_ID || ''
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || ''
export const bucketName = process.env.R2_BUCKET_NAME || 'usersessions-replays'

// Use the explicit endpoint from env — avoids hardcoded jurisdiction assumptions.
// Falls back to the Default endpoint if not set.
const endpoint =
  process.env.R2_ENDPOINT ||
  `https://${accountId}.r2.cloudflarestorage.com`

export const r2Client = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
})

/**
 * Generate a signed URL for reading a session replay JSON blob.
 */
export async function getReplaySignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  })
  // URL expires in 15 minutes
  return getSignedUrl(r2Client, command, { expiresIn: 900 })
}

/**
 * Upload a session replay JSON blob.
 */
export async function uploadReplayData(key: string, data: any): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  })
  await r2Client.send(command)
}

/**
 * Delete a session replay JSON blob (for retention enforcement).
 */
export async function deleteReplayData(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  })
  await r2Client.send(command)
}
