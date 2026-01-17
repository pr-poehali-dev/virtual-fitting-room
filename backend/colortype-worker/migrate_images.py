"""
Script to migrate colortype reference images to permanent S3 storage
Run: python migrate_images.py
"""
import json
import os
import boto3
import requests
from typing import Dict, List
from urllib.parse import urlparse

def download_image(url: str) -> bytes:
    """Download image from URL"""
    print(f"  Downloading: {url}")
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.content

def get_content_type(url: str) -> str:
    """Determine content type from URL"""
    if url.endswith('.jpg') or url.endswith('.jpeg'):
        return 'image/jpeg'
    elif url.endswith('.webp'):
        return 'image/webp'
    elif url.endswith('.png'):
        return 'image/png'
    else:
        return 'image/jpeg'

def sanitize_colortype_name(name: str) -> str:
    """Convert colortype name to folder-friendly format"""
    return name.lower().replace(' ', '-')

def upload_to_s3(s3_client, image_data: bytes, key: str, content_type: str, bucket: str) -> str:
    """Upload image to S3 and return CDN URL"""
    print(f"  Uploading to S3: {key}")
    
    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=image_data,
        ContentType=content_type,
        ACL='public-read'
    )
    
    cdn_url = f"https://storage.yandexcloud.net/{bucket}/{key}"
    print(f"  ✓ Uploaded: {cdn_url}")
    return cdn_url

def migrate_references():
    """Migrate all reference images to S3"""
    print("=" * 80)
    print("COLORTYPE IMAGES MIGRATION TO S3")
    print("=" * 80)
    
    # Get S3 credentials from environment
    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    s3_bucket = os.environ.get('S3_BUCKET_NAME')
    
    if not s3_access_key or not s3_secret_key or not s3_bucket:
        raise Exception('Please set S3_ACCESS_KEY, S3_SECRET_KEY, and S3_BUCKET_NAME environment variables')
    
    print(f"\n1. Configuration:")
    print(f"   Bucket: {s3_bucket}")
    print(f"   Endpoint: https://storage.yandexcloud.net")
    
    # Initialize S3 client
    print("\n2. Initializing S3 client...")
    s3_client = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key,
        region_name='ru-central1'
    )
    print("   ✓ S3 client initialized")
    
    # Load colortype references
    print("\n3. Loading colortype_references.json...")
    with open('colortype_references.json', 'r', encoding='utf-8') as f:
        refs = json.load(f)
    print(f"   Found {len(refs)} color types")
    
    # Track migration stats
    total_images = 0
    migrated_images = 0
    failed_images = []
    
    # New data structure with updated URLs
    new_refs = {}
    
    print("\n4. Starting migration...")
    print("-" * 80)
    
    for colortype, data in refs.items():
        print(f"\n▶ Processing: {colortype}")
        
        folder_name = sanitize_colortype_name(colortype)
        new_data = data.copy()
        
        # Migrate scheme image
        if 'scheme_url' in data:
            total_images += 1
            scheme_url = data['scheme_url']
            
            try:
                # Download image
                image_data = download_image(scheme_url)
                
                # Determine file extension
                file_ext = 'jpg' if scheme_url.endswith('.jpg') else 'jpeg'
                
                # Create S3 key with new structure
                s3_key = f"colortype-schemes/{folder_name}/scheme.{file_ext}"
                content_type = get_content_type(scheme_url)
                
                # Upload to S3
                new_url = upload_to_s3(s3_client, image_data, s3_key, content_type, s3_bucket)
                new_data['scheme_url'] = new_url
                migrated_images += 1
                
            except Exception as e:
                print(f"  ✗ Failed to migrate scheme: {e}")
                failed_images.append({
                    'colortype': colortype,
                    'type': 'scheme',
                    'url': scheme_url,
                    'error': str(e)
                })
                new_data['scheme_url'] = scheme_url  # Keep original on failure
        
        # Migrate example images
        if 'examples' in data:
            new_examples = []
            
            for idx, example_url in enumerate(data['examples'], start=1):
                total_images += 1
                
                try:
                    # Download image
                    image_data = download_image(example_url)
                    
                    # Determine file extension
                    file_ext = 'webp' if example_url.endswith('.webp') else 'jpg'
                    
                    # Create S3 key with new structure
                    s3_key = f"colortype-schemes/{folder_name}/example-{idx}.{file_ext}"
                    content_type = get_content_type(example_url)
                    
                    # Upload to S3
                    new_url = upload_to_s3(s3_client, image_data, s3_key, content_type, s3_bucket)
                    new_examples.append(new_url)
                    migrated_images += 1
                    
                except Exception as e:
                    print(f"  ✗ Failed to migrate example {idx}: {e}")
                    failed_images.append({
                        'colortype': colortype,
                        'type': f'example-{idx}',
                        'url': example_url,
                        'error': str(e)
                    })
                    new_examples.append(example_url)  # Keep original on failure
            
            new_data['examples'] = new_examples
        
        new_refs[colortype] = new_data
    
    print("\n" + "-" * 80)
    print("\n5. Saving new configuration...")
    
    # Save new colortype_references_new.json
    with open('colortype_references_new.json', 'w', encoding='utf-8') as f:
        json.dump(new_refs, f, ensure_ascii=False, indent=2)
    
    print("   ✓ Created: colortype_references_new.json")
    
    # Print summary
    print("\n" + "=" * 80)
    print("MIGRATION SUMMARY")
    print("=" * 80)
    print(f"Total images processed: {total_images}")
    print(f"Successfully migrated: {migrated_images}")
    print(f"Failed migrations: {len(failed_images)}")
    
    if failed_images:
        print("\n⚠ FAILED IMAGES:")
        for failed in failed_images:
            print(f"  - {failed['colortype']} / {failed['type']}")
            print(f"    URL: {failed['url']}")
            print(f"    Error: {failed['error']}")
    
    print("\n✓ NEW S3 STRUCTURE:")
    print(f"  Base path: colortype-schemes/")
    print(f"  Format:")
    print(f"    - colortype-schemes/{{colortype-name}}/scheme.jpg")
    print(f"    - colortype-schemes/{{colortype-name}}/example-1.webp")
    print(f"    - colortype-schemes/{{colortype-name}}/example-2.webp")
    print(f"    - ...")
    
    print(f"\n✓ CDN URLS:")
    print(f"  Base: https://storage.yandexcloud.net/{s3_bucket}/")
    
    print("\n" + "=" * 80)
    print("MIGRATION COMPLETE!")
    print("=" * 80)
    print("\nNext steps:")
    print("  1. Review colortype_references_new.json")
    print("  2. If everything looks good, replace colortype_references.json")
    print("     cp colortype_references_new.json colortype_references.json")
    
    return {
        'total': total_images,
        'migrated': migrated_images,
        'failed': len(failed_images),
        'failed_details': failed_images
    }

if __name__ == '__main__':
    try:
        result = migrate_references()
        
        if result['failed'] > 0:
            print(f"\n⚠ Warning: {result['failed']} images failed to migrate")
            exit(1)
        else:
            print("\n✓ All images migrated successfully!")
            exit(0)
            
    except Exception as e:
        print(f"\n✗ MIGRATION FAILED: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
