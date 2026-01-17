import json
import os
import boto3
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''Получение списка файлов из S3 в colortype-schemes/'''
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }
    
    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    s3_bucket = os.environ.get('S3_BUCKET_NAME', 'fitting-room-images')
    
    if not all([s3_access_key, s3_secret_key]):
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'S3 credentials not configured'})
        }
    
    s3 = boto3.client('s3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key,
        region_name='ru-central1'
    )
    
    try:
        response = s3.list_objects_v2(
            Bucket=s3_bucket,
            Prefix='colortype-schemes/',
            MaxKeys=100
        )
        
        files = []
        if 'Contents' in response:
            files = [obj['Key'] for obj in response['Contents']]
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'bucket': s3_bucket,
                'prefix': 'colortype-schemes/',
                'total_files': len(files),
                'files': files
            }, ensure_ascii=False, indent=2)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'error': str(e),
                'bucket': s3_bucket
            }, ensure_ascii=False)
        }
