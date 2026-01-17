# Colortype Images Migration - Complete Solution

## Overview

A complete solution to migrate all colortype reference images from external CDN (`cdn.poehali.dev`) to your Yandex Cloud S3 storage.

## What Was Created

### 1. Main Migration Script
**File:** `migrate_images.py`

The core script that performs the migration:
- Downloads all images from `colortype_references.json`
- Uploads to S3 with organized structure
- Creates `colortype_references_new.json` with updated URLs
- Provides detailed progress and error reporting

**Key Features:**
- Preserves file formats (jpg, jpeg, webp)
- Sets correct Content-Type headers
- Makes files publicly readable
- Handles errors gracefully
- Shows real-time progress

### 2. Connection Test Utility
**File:** `test_s3_connection.py`

Pre-migration testing tool that:
- Validates environment variables
- Tests S3 client initialization
- Checks bucket access permissions
- Uploads/deletes a test file
- Confirms write permissions

### 3. Analysis Tools
**Files:** `analyze_migration.py`, `count_images.py`

Pre-migration analysis utilities:
- Shows what will be migrated
- Counts total images per colortype
- Previews new S3 structure
- Helps plan the migration

### 4. Documentation
**Files:** `MIGRATION_INSTRUCTIONS.md`, `EXECUTION_GUIDE.md`, `MIGRATION_SUMMARY.md` (this file)

Complete documentation covering:
- Step-by-step execution guide
- Troubleshooting procedures
- Rollback instructions
- Post-migration verification

## Migration Statistics

### Source Data
- **File:** `backend/colortype-worker/colortype_references.json`
- **Color Types:** 12 total
- **Source CDN:** `https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/`

### Images Breakdown

| Color Type       | Scheme | Examples | Total |
|------------------|--------|----------|-------|
| VIBRANT SPRING   | 1      | 4        | 5     |
| BRIGHT SPRING    | 1      | 4        | 5     |
| GENTLE SPRING    | 1      | 5        | 6     |
| SOFT SUMMER      | 1      | 7        | 8     |
| VIVID SUMMER     | 1      | 9        | 10    |
| DUSTY SUMMER     | 1      | 9        | 10    |
| GENTLE AUTUMN    | 1      | 8        | 9     |
| FIERY AUTUMN     | 1      | 6        | 7     |
| VIVID AUTUMN     | 1      | 8        | 9     |
| SOFT WINTER      | 1      | 4        | 5     |
| BRIGHT WINTER    | 1      | 4        | 5     |
| VIVID WINTER     | 1      | 5        | 6     |
| **TOTAL**        | **12** | **73**   | **85** |

## New S3 Structure

### Folder Organization
```
colortype-schemes/
├── vibrant-spring/
│   ├── scheme.jpg
│   └── example-{1-4}.webp
├── bright-spring/
│   ├── scheme.jpg
│   └── example-{1-4}.webp
├── gentle-spring/
│   ├── scheme.jpg
│   └── example-{1-5}.webp
├── soft-summer/
│   ├── scheme.jpg
│   └── example-{1-7}.webp
├── vivid-summer/
│   ├── scheme.jpg
│   └── example-{1-9}.webp
├── dusty-summer/
│   ├── scheme.jpg
│   └── example-{1-9}.webp
├── gentle-autumn/
│   ├── scheme.jpg
│   └── example-{1-8}.webp
├── fiery-autumn/
│   ├── scheme.jpg
│   └── example-{1-6}.webp
├── vivid-autumn/
│   ├── scheme.jpg
│   └── example-{1-8}.webp
├── soft-winter/
│   ├── scheme.jpg
│   └── example-{1-4}.webp
├── bright-winter/
│   ├── scheme.jpg
│   └── example-{1-4}.webp
└── vivid-winter/
    ├── scheme.jpg
    └── example-{1-5}.webp
```

### URL Format
```
https://storage.yandexcloud.net/{bucket-name}/colortype-schemes/{colortype-name}/{file}
```

### Example URLs
Before:
```
https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/cover_-bright-spring-1-1.jpg
https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vibrant-spring1.webp
```

After:
```
https://storage.yandexcloud.net/{bucket}/colortype-schemes/vibrant-spring/scheme.jpg
https://storage.yandexcloud.net/{bucket}/colortype-schemes/vibrant-spring/example-1.webp
```

## Quick Start

### Prerequisites
```bash
# 1. Ensure you're in the correct directory
cd backend/colortype-worker

# 2. Install dependencies (if needed)
pip3 install -r requirements.txt
```

### Set Environment Variables
```bash
export S3_ACCESS_KEY="your-access-key"
export S3_SECRET_KEY="your-secret-key"
export S3_BUCKET_NAME="your-bucket-name"
```

### Run Migration (3 Steps)
```bash
# Step 1: Test connection
python3 test_s3_connection.py

# Step 2: Run migration
python3 migrate_images.py

# Step 3: Apply changes
cp colortype_references_new.json colortype_references.json
```

## Expected Results

### Console Output
```
================================================================================
COLORTYPE IMAGES MIGRATION TO S3
================================================================================

1. Configuration:
   Bucket: your-bucket-name
   Endpoint: https://storage.yandexcloud.net

2. Initializing S3 client...
   ✓ S3 client initialized

3. Loading colortype_references.json...
   Found 12 color types

4. Starting migration...
--------------------------------------------------------------------------------

▶ Processing: VIBRANT SPRING
  Downloading: https://cdn.poehali.dev/.../cover_-bright-spring-1-1.jpg
  Uploading to S3: colortype-schemes/vibrant-spring/scheme.jpg
  ✓ Uploaded: https://storage.yandexcloud.net/{bucket}/colortype-schemes/vibrant-spring/scheme.jpg
  ...

================================================================================
MIGRATION SUMMARY
================================================================================
Total images processed: 85
Successfully migrated: 85
Failed migrations: 0

✓ NEW S3 STRUCTURE:
  Base path: colortype-schemes/
  Format:
    - colortype-schemes/{colortype-name}/scheme.jpg
    - colortype-schemes/{colortype-name}/example-1.webp
    - colortype-schemes/{colortype-name}/example-2.webp
    - ...

================================================================================
MIGRATION COMPLETE!
================================================================================
```

### Generated Files
After running the migration:
- `colortype_references_new.json` - New configuration with S3 URLs
- Migration logs in console output

## Technical Details

### S3 Configuration
- **Endpoint:** `https://storage.yandexcloud.net`
- **Region:** `ru-central1`
- **ACL:** `public-read` (images are publicly accessible)
- **Content-Type:** Automatically set based on file extension
  - `.jpg`, `.jpeg` → `image/jpeg`
  - `.webp` → `image/webp`
  - `.png` → `image/png`

### File Naming Convention
- **Colortype folders:** Lowercase with hyphens (e.g., `vibrant-spring`)
- **Scheme images:** `scheme.{ext}` (preserves original extension)
- **Example images:** `example-{n}.{ext}` (numbered 1, 2, 3, ...)

### Error Handling
- Network errors: Retryable (just re-run the script)
- S3 errors: Logged with details
- Failed images: Keep original URLs
- Partial success: Supported (some images can fail without breaking others)

## Benefits

1. **Reliability:** Your own S3 storage is more reliable than external CDN
2. **Control:** Full control over image storage and access
3. **Performance:** Yandex Cloud CDN is fast and reliable
4. **Organization:** Clean, predictable folder structure
5. **Maintainability:** Easy to add/update images in the future
6. **Cost:** Potentially lower costs vs. external CDN

## Next Steps After Migration

1. **Verify URLs** - Test a few URLs in browser
2. **Test Application** - Ensure colortype analysis works
3. **Monitor Usage** - Check S3 storage usage in Yandex Cloud
4. **Update Documentation** - Document new CDN URLs for team
5. **Cleanup** - Consider removing old CDN files (if you have access)

## Rollback Plan

If something goes wrong:
```bash
# Option 1: Git restore
git checkout colortype_references.json

# Option 2: Use backup
cp colortype_references.json.backup colortype_references.json
```

The migration script does NOT delete original images, so rollback is safe.

## File Locations

All files are in: `backend/colortype-worker/`

```
backend/colortype-worker/
├── colortype_references.json          # Original config (source)
├── colortype_references_new.json      # New config (generated)
├── migrate_images.py                  # Main migration script
├── test_s3_connection.py              # Connection test utility
├── analyze_migration.py               # Pre-migration analysis
├── count_images.py                    # Quick image counter
├── MIGRATION_INSTRUCTIONS.md          # Detailed instructions
├── EXECUTION_GUIDE.md                 # Step-by-step guide
└── MIGRATION_SUMMARY.md               # This file
```

## Support

For issues:
1. Check error messages in console output
2. Review troubleshooting in `EXECUTION_GUIDE.md`
3. Verify S3 credentials and permissions
4. Test with `test_s3_connection.py`

## Completion Checklist

- [ ] Set environment variables (S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_NAME)
- [ ] Run `python3 test_s3_connection.py` (should pass)
- [ ] Run `python3 migrate_images.py` (should show 85/85 success)
- [ ] Review `colortype_references_new.json` (should have new URLs)
- [ ] Backup original: `cp colortype_references.json colortype_references.json.backup`
- [ ] Apply changes: `cp colortype_references_new.json colortype_references.json`
- [ ] Test a few URLs in browser (should load images)
- [ ] Commit changes: `git add colortype_references.json && git commit`
- [ ] Test application (colortype analysis should work)
- [ ] Document completion date and results

---

**Ready to migrate?** Start with `EXECUTION_GUIDE.md` for step-by-step instructions.
