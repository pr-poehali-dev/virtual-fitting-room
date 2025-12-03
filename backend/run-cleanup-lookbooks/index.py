import json
import os
from typing import Dict, Any
import boto3
from botocore.config import Config

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Cleanup old files in lookbooks/ root folder (internal use)
    Args: event - dict with httpMethod
          context - object with attributes: request_id, function_name
    Returns: HTTP response with cleanup stats
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    try:
        s3_client = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            aws_access_key_id=os.environ.get('S3_ACCESS_KEY'),
            aws_secret_access_key=os.environ.get('S3_SECRET_KEY'),
            region_name='ru-central1',
            config=Config(signature_version='s3v4')
        )
        
        s3_bucket_name = os.environ.get('S3_BUCKET_NAME')
        
        # List all files in images/lookbooks/ (not in subfolders)
        response = s3_client.list_objects_v2(
            Bucket=s3_bucket_name,
            Prefix='images/lookbooks/',
            Delimiter='/'
        )
        
        deleted_count = 0
        files_list = []
        
        if 'Contents' in response:
            for obj in response['Contents']:
                key = obj['Key']
                # Only delete files directly in lookbooks/, not in subfolders
                # File in root: images/lookbooks/filename.jpg
                # File in subfolder: images/lookbooks/user_id/filename.jpg
                if key.count('/') == 2 and key != 'images/lookbooks/':
                    files_list.append(key)
                    try:
                        s3_client.delete_object(
                            Bucket=s3_bucket_name,
                            Key=key
                        )
                        deleted_count += 1
                        print(f'Deleted from S3: {key}')
                    except Exception as e:
                        print(f'Failed to delete {key}: {e}')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({
                'message': f'Cleaned up {deleted_count} old files from lookbooks/ root',
                'deleted': deleted_count,
                'files': files_list[:50]  # Show first 50 files
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Cleanup failed: {str(e)}'})
        }
