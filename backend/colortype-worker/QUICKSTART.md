# Quick Start - Image Migration

## TL;DR

Migrate 85 colortype reference images from external CDN to your S3 storage in 3 commands.

## Prerequisites

```bash
cd backend/colortype-worker
pip3 install -r requirements.txt
```

## 3-Step Migration

### 1. Set Credentials
```bash
export S3_ACCESS_KEY="your-access-key"
export S3_SECRET_KEY="your-secret-key"
export S3_BUCKET_NAME="your-bucket-name"
```

### 2. Test & Migrate
```bash
# Test connection (optional but recommended)
python3 test_s3_connection.py

# Run migration
python3 migrate_images.py
```

### 3. Apply Changes
```bash
# Backup (optional)
cp colortype_references.json colortype_references.json.backup

# Apply new URLs
cp colortype_references_new.json colortype_references.json

# Commit
git add colortype_references.json
git commit -m "Migrate colortype images to S3"
```

## What It Does

- Downloads 85 images from `cdn.poehali.dev`
- Uploads to `s3://your-bucket/colortype-schemes/`
- Updates all URLs in `colortype_references.json`
- Organizes in clean folder structure

## New Structure

```
colortype-schemes/
├── vibrant-spring/
│   ├── scheme.jpg
│   └── example-{1-4}.webp
├── bright-spring/...
└── ... (12 colortypes total)
```

## New URLs

```
https://storage.yandexcloud.net/{bucket}/colortype-schemes/{colortype}/scheme.jpg
https://storage.yandexcloud.net/{bucket}/colortype-schemes/{colortype}/example-N.webp
```

## Expected Output

```
Total images processed: 85
Successfully migrated: 85
Failed migrations: 0
✓ Migration complete!
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Please set S3_ACCESS_KEY..." | Export all 3 env vars |
| "Failed to download..." | Check internet connection |
| "Access denied..." | Verify S3 credentials |

## Rollback

```bash
git checkout colortype_references.json
# or
cp colortype_references.json.backup colortype_references.json
```

## Time Required

- Setup: 2 minutes
- Migration: 5-10 minutes
- Verification: 2 minutes
- **Total: ~15 minutes**

## For More Details

- **Full guide:** `EXECUTION_GUIDE.md`
- **Technical details:** `MIGRATION_SUMMARY.md`
- **Instructions:** `MIGRATION_INSTRUCTIONS.md`

---

**Ready?** Just run the 3 commands above!
