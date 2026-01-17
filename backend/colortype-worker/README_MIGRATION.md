# Colortype Images Migration to S3

Complete solution for migrating all colortype reference images from external CDN to Yandex Cloud S3 storage.

## 📋 Overview

This migration will move **85 images** (12 schemes + 73 examples) from `cdn.poehali.dev` to your S3 bucket with a clean, organized structure.

## 🚀 Quick Start

**Want to jump right in?** See [QUICKSTART.md](QUICKSTART.md) for the 3-command migration.

**Need detailed instructions?** See [EXECUTION_GUIDE.md](EXECUTION_GUIDE.md) for step-by-step guide.

## 📁 Files in This Solution

### Migration Scripts
- **migrate_images.py** - Main migration script (downloads & uploads images)
- **test_s3_connection.py** - S3 connection test utility
- **analyze_migration.py** - Pre-migration analysis tool
- **count_images.py** - Quick image count summary

### Documentation
- **QUICKSTART.md** - 3-command quick start guide
- **EXECUTION_GUIDE.md** - Detailed step-by-step instructions
- **MIGRATION_INSTRUCTIONS.md** - Technical documentation
- **MIGRATION_SUMMARY.md** - Complete solution overview
- **README_MIGRATION.md** - This file

### Data Files
- **colortype_references.json** - Original configuration (source)
- **colortype_references_new.json** - Generated after migration (output)

## 🎯 What Gets Migrated

### Image Statistics
- 12 color types
- 12 scheme images (1 per colortype)
- 73 example images (4-9 per colortype)
- **85 total images**

### Colortype Breakdown
```
VIBRANT SPRING   →  5 images (1 scheme + 4 examples)
BRIGHT SPRING    →  5 images (1 scheme + 4 examples)
GENTLE SPRING    →  6 images (1 scheme + 5 examples)
SOFT SUMMER      →  8 images (1 scheme + 7 examples)
VIVID SUMMER     → 10 images (1 scheme + 9 examples)
DUSTY SUMMER     → 10 images (1 scheme + 9 examples)
GENTLE AUTUMN    →  9 images (1 scheme + 8 examples)
FIERY AUTUMN     →  7 images (1 scheme + 6 examples)
VIVID AUTUMN     →  9 images (1 scheme + 8 examples)
SOFT WINTER      →  5 images (1 scheme + 4 examples)
BRIGHT WINTER    →  5 images (1 scheme + 4 examples)
VIVID WINTER     →  6 images (1 scheme + 5 examples)
```

## 📂 New S3 Structure

Images will be organized as:
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
│   └── example-{1-4}.webp
└── ... (10 more colortypes)
```

## 🔗 URL Format

**Before:**
```
https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/cover_-bright-spring-1-1.jpg
```

**After:**
```
https://storage.yandexcloud.net/{bucket}/colortype-schemes/vibrant-spring/scheme.jpg
```

## ⚡ Migration Steps

### 1. Setup (2 minutes)
```bash
cd backend/colortype-worker
export S3_ACCESS_KEY="your-key"
export S3_SECRET_KEY="your-secret"
export S3_BUCKET_NAME="your-bucket"
```

### 2. Test (1 minute)
```bash
python3 test_s3_connection.py
```

### 3. Migrate (5-10 minutes)
```bash
python3 migrate_images.py
```

### 4. Apply (1 minute)
```bash
cp colortype_references_new.json colortype_references.json
git add colortype_references.json
git commit -m "Migrate colortype images to S3"
```

## ✅ Success Criteria

After migration, you should see:
- ✓ Console shows "85 images successfully migrated"
- ✓ `colortype_references_new.json` exists with new URLs
- ✓ New URLs start with `https://storage.yandexcloud.net/`
- ✓ Test URLs in browser load correctly

## 🔍 Pre-Migration Analysis

Want to see what will be migrated first?
```bash
python3 count_images.py
python3 analyze_migration.py
```

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| Environment variables not set | Run `export` commands |
| S3 connection fails | Check credentials with `test_s3_connection.py` |
| Download errors | Check internet connection |
| Upload errors | Verify S3 bucket permissions |
| Partial migration | Re-run `migrate_images.py` (it's idempotent) |

For detailed troubleshooting, see [EXECUTION_GUIDE.md](EXECUTION_GUIDE.md).

## 🔄 Rollback

If needed, rollback is easy:
```bash
# Option 1: Git
git checkout colortype_references.json

# Option 2: Backup
cp colortype_references.json.backup colortype_references.json
```

The original CDN images are NOT deleted, so rollback is always safe.

## 📊 Benefits

- **Reliability:** Own your image storage
- **Performance:** Fast Yandex Cloud CDN
- **Organization:** Clean folder structure
- **Control:** Full access and management
- **Cost:** Potentially lower than external CDN

## ⏱️ Time Estimate

- Setup & testing: 5 minutes
- Migration execution: 5-10 minutes
- Verification: 2 minutes
- **Total: ~15 minutes**

## 📚 Documentation Hierarchy

1. **Start here** → [QUICKSTART.md](QUICKSTART.md) - If you want to migrate NOW
2. **Detailed guide** → [EXECUTION_GUIDE.md](EXECUTION_GUIDE.md) - Step-by-step with explanations
3. **Technical details** → [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) - Complete overview
4. **Reference** → [MIGRATION_INSTRUCTIONS.md](MIGRATION_INSTRUCTIONS.md) - Technical specs

## 🎓 How It Works

1. **Read** `colortype_references.json` to get all image URLs
2. **Download** each image from `cdn.poehali.dev`
3. **Upload** to S3 at `colortype-schemes/{colortype}/{file}`
4. **Set** proper Content-Type and public-read ACL
5. **Generate** `colortype_references_new.json` with new URLs
6. **Report** success/failure for each image

## 🔐 Security Notes

- Environment variables are NOT committed to git
- S3 credentials should be kept secure
- Images are uploaded with `public-read` ACL (required for web access)
- No sensitive data is in the images themselves

## 📝 Post-Migration

After successful migration:
1. Test application functionality
2. Monitor S3 storage usage
3. Document new CDN URLs
4. Consider cleanup of old CDN (if you have access)
5. Update any hardcoded URLs in other systems

## 🆘 Support

If you encounter issues:
1. Check error messages in console output
2. Review troubleshooting section in docs
3. Test S3 connection with `test_s3_connection.py`
4. Verify environment variables are set correctly
5. Check Yandex Cloud console for bucket access

## 🏁 Ready to Start?

Choose your path:
- **Fast track:** [QUICKSTART.md](QUICKSTART.md) → 3 commands, done!
- **Guided tour:** [EXECUTION_GUIDE.md](EXECUTION_GUIDE.md) → Step-by-step with safety checks
- **Deep dive:** [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) → All the technical details

---

**Current Status:** Ready to migrate. All tools are prepared.

**Last Updated:** 2026-01-17

**Version:** 1.0
