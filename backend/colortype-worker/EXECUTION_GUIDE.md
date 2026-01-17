# Image Migration Execution Guide

This guide provides step-by-step instructions to migrate all colortype reference images from the external CDN to your S3 storage.

## What Will Be Migrated

The migration script will process:
- **12 color types** (VIBRANT SPRING, BRIGHT SPRING, GENTLE SPRING, SOFT SUMMER, VIVID SUMMER, DUSTY SUMMER, GENTLE AUTUMN, FIERY AUTUMN, VIVID AUTUMN, SOFT WINTER, BRIGHT WINTER, VIVID WINTER)
- **~82 total images**:
  - 12 scheme images (1 per colortype)
  - ~70 example images (varies per colortype: 4-9 examples each)

## Pre-Migration Steps

### 1. Verify Your Current Setup

Check that you're in the correct directory:
```bash
cd backend/colortype-worker
ls -la colortype_references.json
```

### 2. Analyze What Will Be Migrated

Run the analysis script to see a detailed breakdown:
```bash
python3 count_images.py
```

This will show you exactly how many images will be migrated for each colortype.

### 3. Check Python Dependencies

Verify that required packages are installed:
```bash
pip3 install -r requirements.txt
```

Required packages:
- `boto3>=1.28.0` (for S3 operations)
- `requests>=2.31.0` (for downloading images)
- `psycopg2-binary>=2.9.0` (already installed)

## Migration Execution

### Step 1: Set Environment Variables

You need to set three environment variables with your S3 credentials:

```bash
export S3_ACCESS_KEY="your-yandex-cloud-access-key"
export S3_SECRET_KEY="your-yandex-cloud-secret-key"
export S3_BUCKET_NAME="your-bucket-name"
```

**Important:** Keep these credentials secure and never commit them to version control.

### Step 2: Test S3 Connection

Before running the full migration, test that your S3 credentials work:

```bash
python3 test_s3_connection.py
```

This script will:
1. Verify environment variables are set
2. Initialize S3 client
3. Test bucket access
4. Upload a test file
5. Delete the test file

If this fails, check your credentials before proceeding.

### Step 3: Run the Migration

Once the connection test passes, run the migration:

```bash
python3 migrate_images.py
```

The script will:
1. Load `colortype_references.json`
2. Download each image from the CDN
3. Upload to S3 with the new structure
4. Create `colortype_references_new.json` with updated URLs
5. Display a summary report

**Expected Runtime:** 5-10 minutes depending on network speed.

### Step 4: Review Results

After migration completes, review the new file:

```bash
# View the new configuration
cat colortype_references_new.json | head -50

# Compare with original
diff colortype_references.json colortype_references_new.json
```

Check the migration summary output for:
- Total images processed
- Successfully migrated count
- Any failed migrations

### Step 5: Apply the Changes

If everything looks good, replace the old file:

```bash
# Backup the original (optional but recommended)
cp colortype_references.json colortype_references.json.backup

# Apply the new configuration
cp colortype_references_new.json colortype_references.json
```

### Step 6: Commit Changes

Add and commit the updated file:

```bash
git add colortype_references.json
git commit -m "Migrate colortype reference images to S3 storage"
git push
```

## New S3 Structure

After migration, your S3 bucket will have this structure:

```
s3://your-bucket/
└── colortype-schemes/
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
    └── ... (9 more colortypes)
```

## CDN URLs

All images will be publicly accessible via:

```
https://storage.yandexcloud.net/{bucket-name}/colortype-schemes/{colortype-name}/{image-file}
```

Examples:
```
https://storage.yandexcloud.net/fitting-room-images/colortype-schemes/vibrant-spring/scheme.jpg
https://storage.yandexcloud.net/fitting-room-images/colortype-schemes/vibrant-spring/example-1.webp
https://storage.yandexcloud.net/fitting-room-images/colortype-schemes/bright-spring/scheme.jpg
```

## Troubleshooting

### Error: "Please set S3_ACCESS_KEY..."

**Solution:** Make sure all three environment variables are set:
```bash
echo $S3_ACCESS_KEY
echo $S3_SECRET_KEY
echo $S3_BUCKET_NAME
```

If any are empty, set them again.

### Error: "Failed to download..."

**Cause:** Network issue or source CDN is down.

**Solution:** 
- Check your internet connection
- Try accessing one of the source URLs in a browser
- Wait and retry the migration

### Error: "Access denied to bucket"

**Cause:** Invalid S3 credentials or insufficient permissions.

**Solution:**
- Verify your access key and secret key are correct
- Ensure your Yandex Cloud IAM user has write permissions to the bucket
- Check that the bucket name is spelled correctly

### Some Images Failed to Migrate

The script will continue even if some images fail. Failed images will:
- Be listed in the summary output
- Keep their original URLs in `colortype_references_new.json`

You can re-run the migration script to retry failed images.

## Rollback Procedure

If you need to rollback to the original configuration:

### Option 1: Use Git
```bash
git checkout colortype_references.json
```

### Option 2: Use Backup
```bash
cp colortype_references.json.backup colortype_references.json
```

### Option 3: Restore from colortype_references_new.json
If you haven't deleted it, you can manually review and selectively restore URLs.

## Verification

After migration, verify that the new URLs work:

```bash
# Test a few URLs from colortype_references.json
curl -I "https://storage.yandexcloud.net/your-bucket/colortype-schemes/vibrant-spring/scheme.jpg"
```

You should see `HTTP/2 200` response.

## Post-Migration

After successful migration:

1. **Test the application** to ensure colortype analysis still works
2. **Monitor S3 storage** usage in Yandex Cloud console
3. **Consider cleanup** of old CDN files (if you have access)
4. **Document the new CDN URLs** for your team

## Files Created

The migration process creates these files:

- `migrate_images.py` - Main migration script
- `test_s3_connection.py` - S3 connection test utility
- `analyze_migration.py` - Pre-migration analysis tool
- `count_images.py` - Quick image count summary
- `colortype_references_new.json` - New configuration (after migration)
- `MIGRATION_INSTRUCTIONS.md` - Detailed documentation
- `EXECUTION_GUIDE.md` - This file

## Support

If you encounter issues:

1. Check the error message in the migration output
2. Review the "Troubleshooting" section above
3. Verify your S3 credentials and permissions
4. Check network connectivity
5. Review Yandex Cloud console for bucket access

## Summary

This migration will:
- ✓ Move ~82 images to your S3 storage
- ✓ Organize them in a clean folder structure
- ✓ Update all URLs in colortype_references.json
- ✓ Make images permanently available from your CDN
- ✓ Maintain backward compatibility (original structure preserved)

Estimated total time: 15-20 minutes including testing.
