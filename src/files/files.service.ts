import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FilesService {
  private s3Client: S3Client;
  private bucketName = 'products'; // Bucket name from Supabase

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      forcePathStyle: true,
      region: 'us-east-1', // Dummy region for Supabase
      endpoint: 'https://rnhwvaurswbnnxyedzsx.storage.supabase.co/storage/v1/s3',
      credentials: {
        accessKeyId: 'bb2959286a8d20fe39d6d0e53a17873f', // Provided by user
        secretAccessKey: '32485a52da84465ba06949bd8bad15c94d5e14ba2e142ac852757dc30c3acaa3', // Provided by user
      },
    });
  }

  async uploadFile(file: Express.Multer.File) {
    const fileName = `${Date.now()}-${file.originalname}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read', // Ensure file is public
        }),
      );

      // Construct Public URL
      // Supabase S3 endpoint + /bucket/key
      const publicUrl = `https://rnhwvaurswbnnxyedzsx.storage.supabase.co/storage/v1/object/public/${this.bucketName}/${fileName}`;

      return {
        url: publicUrl,
      };
    } catch (error) {
      console.error('S3 Upload Error:', error);
      throw new InternalServerErrorException(`Upload failed: ${error.message}`);
    }
  }
}
