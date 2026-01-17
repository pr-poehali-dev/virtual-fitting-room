"""
Test S3 connection and credentials
Run: python test_s3_connection.py
"""
import os
import boto3
from botocore.exceptions import ClientError

def test_s3_connection():
    """Test S3 connection and credentials"""
    print("=" * 60)
    print("S3 CONNECTION TEST")
    print("=" * 60)
    
    # Get credentials
    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    s3_bucket = os.environ.get('S3_BUCKET_NAME')
    
    print("\n1. Checking environment variables...")
    
    if not s3_access_key:
        print("   ✗ S3_ACCESS_KEY not set")
        return False
    else:
        print(f"   ✓ S3_ACCESS_KEY: {s3_access_key[:10]}...")
    
    if not s3_secret_key:
        print("   ✗ S3_SECRET_KEY not set")
        return False
    else:
        print(f"   ✓ S3_SECRET_KEY: {s3_secret_key[:10]}...")
    
    if not s3_bucket:
        print("   ✗ S3_BUCKET_NAME not set")
        return False
    else:
        print(f"   ✓ S3_BUCKET_NAME: {s3_bucket}")
    
    # Initialize S3 client
    print("\n2. Initializing S3 client...")
    try:
        s3_client = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            aws_access_key_id=s3_access_key,
            aws_secret_access_key=s3_secret_key,
            region_name='ru-central1'
        )
        print("   ✓ S3 client initialized")
    except Exception as e:
        print(f"   ✗ Failed to initialize S3 client: {e}")
        return False
    
    # Test bucket access
    print("\n3. Testing bucket access...")
    try:
        response = s3_client.head_bucket(Bucket=s3_bucket)
        print(f"   ✓ Bucket '{s3_bucket}' is accessible")
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            print(f"   ✗ Bucket '{s3_bucket}' does not exist")
        elif error_code == '403':
            print(f"   ✗ Access denied to bucket '{s3_bucket}'")
        else:
            print(f"   ✗ Error accessing bucket: {e}")
        return False
    except Exception as e:
        print(f"   ✗ Unexpected error: {e}")
        return False
    
    # Test write permission with a test file
    print("\n4. Testing write permissions...")
    test_key = "test-connection/test.txt"
    test_content = b"Test connection"
    
    try:
        s3_client.put_object(
            Bucket=s3_bucket,
            Key=test_key,
            Body=test_content,
            ContentType='text/plain',
            ACL='public-read'
        )
        print(f"   ✓ Successfully uploaded test file: {test_key}")
        
        # Generate CDN URL
        cdn_url = f"https://storage.yandexcloud.net/{s3_bucket}/{test_key}"
        print(f"   ✓ CDN URL: {cdn_url}")
        
    except Exception as e:
        print(f"   ✗ Failed to upload test file: {e}")
        return False
    
    # Clean up test file
    print("\n5. Cleaning up test file...")
    try:
        s3_client.delete_object(Bucket=s3_bucket, Key=test_key)
        print(f"   ✓ Test file deleted")
    except Exception as e:
        print(f"   ⚠ Warning: Could not delete test file: {e}")
    
    print("\n" + "=" * 60)
    print("✓ S3 CONNECTION TEST PASSED")
    print("=" * 60)
    print("\nYou can now run the migration script:")
    print("  python migrate_images.py")
    print()
    
    return True

if __name__ == '__main__':
    try:
        success = test_s3_connection()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n✗ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
