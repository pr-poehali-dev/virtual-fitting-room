# Colortype Images Migration to S3

This guide explains how to migrate all colortype reference images from the external CDN to your S3 storage.

## Prerequisites

1. **S3 Credentials** - You need the following environment variables set:
   - `S3_ACCESS_KEY` - Your Yandex Cloud S3 access key
   - `S3_SECRET_KEY` - Your Yandex Cloud S3 secret key
   - `S3_BUCKET_NAME` - Your S3 bucket name

2. **Python Dependencies** - Already installed via requirements.txt:
   - `boto3>=1.28.0`
   - `requests>=2.31.0`

## Migration Process

### Step 1: Set Environment Variables

```bash
export S3_ACCESS_KEY="your-access-key"
export S3_SECRET_KEY="your-secret-key"
export S3_BUCKET_NAME="your-bucket-name"
```

### Step 2: Run Migration Script

```bash
cd backend/colortype-worker
python migrate_images.py
```

### Step 3: Review Results

The script will:
1. Download all images from colortype_references.json (scheme_url + examples)
2. Upload them to S3 with the new structure
3. Create `colortype_references_new.json` with updated URLs

### Step 4: Verify and Apply

```bash
# Review the new file
cat colortype_references_new.json

# If everything looks good, replace the old file
cp colortype_references_new.json colortype_references.json
```

## New S3 Structure

Images will be organized as follows:

```
colortype-schemes/
├── vibrant-spring/
│   ├── scheme.jpg
│   ├── example-1.webp
│   ├── example-2.webp
│   ├── example-3.webp
│   └── example-4.webp
├── bright-spring/
│   ├── scheme.jpg
│   ├── example-1.webp
│   ├── example-2.webp
│   ├── example-3.webp
│   └── example-4.webp
├── gentle-spring/
│   ├── scheme.jpg
│   ├── example-1.webp
│   ├── example-2.webp
│   ├── example-3.webp
│   ├── example-4.webp
│   └── example-5.webp
└── ... (all 12 colortypes)
```

## CDN URLs

All images will be accessible via:
```
https://storage.yandexcloud.net/{bucket-name}/colortype-schemes/{colortype-name}/{image-file}
```

Example:
```
https://storage.yandexcloud.net/fitting-room-images/colortype-schemes/vibrant-spring/scheme.jpg
https://storage.yandexcloud.net/fitting-room-images/colortype-schemes/vibrant-spring/example-1.webp
```

## Migration Statistics

The script will process:
- 12 color types
- 12 scheme images (1 per colortype)
- ~70 example images (varies per colortype)
- **Total: ~82 images**

## Troubleshooting

### Error: "Please set S3_ACCESS_KEY..."
Make sure all environment variables are set correctly.

### Error: "Failed to download..."
Check your internet connection and that the source URLs are accessible.

### Error: "Failed to upload..."
Verify your S3 credentials and bucket permissions.

## Migration Rollback

If you need to rollback:
```bash
# Restore original file (if you have backup)
git checkout colortype_references.json

# Or manually restore from git history
```

## Notes

- Images are uploaded with `ACL='public-read'` for public access
- Content-Type is set correctly for each image format (image/jpeg, image/webp)
- Failed uploads will be reported but won't stop the entire migration
- Original URLs are preserved in case of upload failures
