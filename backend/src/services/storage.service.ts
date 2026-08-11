import fs from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../config/env.js';

export interface ImageStorage {
  save(key: string, buffer: Buffer, contentType: string): Promise<string>;
  resolveUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export class S3ImageStorage implements ImageStorage {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  }

  async save(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }));
    return key;
  }

  async resolveUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }
}

export class LocalImageStorage implements ImageStorage {
  constructor(private readonly baseDir: string, private readonly publicBase: string) {}

  async save(key: string, buffer: Buffer): Promise<string> {
    const target = path.join(this.baseDir, key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buffer);
    return key;
  }

  async resolveUrl(key: string): Promise<string> {
    return `${this.publicBase}/${key}`;
  }
}

export function isS3Configured(env: Pick<Env, 's3Bucket' | 'awsRegion' | 'awsAccessKeyId' | 'awsSecretAccessKey'>): boolean {
  return Boolean(env.s3Bucket && env.awsRegion && env.awsAccessKeyId && env.awsSecretAccessKey);
}

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
export const UPLOADS_PUBLIC_BASE = '/uploads';
