import fs from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Env } from '../config/env.js';

export interface ImageStorage {
  save(key: string, buffer: Buffer, contentType: string): Promise<string>;
}

export class S3ImageStorage implements ImageStorage {
  private readonly client: S3Client;
  private readonly region: string;

  constructor(
    private readonly bucket: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.region = region;
    this.client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  }

  async save(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType, ACL: 'public-read' }),
    );
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}

export class LocalImageStorage implements ImageStorage {
  constructor(private readonly baseDir: string, private readonly publicBase: string) {}

  async save(key: string, buffer: Buffer): Promise<string> {
    const target = path.join(this.baseDir, key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buffer);
    return `${this.publicBase}/${key}`;
  }
}

export function isS3Configured(env: Pick<Env, 's3Bucket' | 'awsRegion' | 'awsAccessKeyId' | 'awsSecretAccessKey'>): boolean {
  return Boolean(env.s3Bucket && env.awsRegion && env.awsAccessKeyId && env.awsSecretAccessKey);
}

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
export const UPLOADS_PUBLIC_BASE = '/uploads';