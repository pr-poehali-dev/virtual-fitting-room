import json
import os
import boto3
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''Создание структуры папок для цветотипов в S3'''
    
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
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
    
    colortypes = [
        'vibrant-spring',
        'bright-spring',
        'gentle-spring',
        'soft-summer',
        'vivid-summer',
        'dusty-summer',
        'gentle-autumn',
        'fiery-autumn',
        'vivid-autumn',
        'vivid-winter',
        'soft-winter',
        'bright-winter'
    ]
    
    created_folders = []
    
    for colortype in colortypes:
        folder_key = f'colortype-schemes/{colortype}/.keep'
        
        try:
            s3.put_object(
                Bucket=s3_bucket,
                Key=folder_key,
                Body=b'',
                ContentType='text/plain'
            )
            created_folders.append(colortype)
            print(f'Created folder: colortype-schemes/{colortype}/')
            
        except Exception as e:
            print(f'Error creating folder {colortype}: {str(e)}')
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'success': True,
            'created': len(created_folders),
            'folders': created_folders,
            'message': f'Создано {len(created_folders)} папок в colortype-schemes/'
        }, ensure_ascii=False)
    }
