import json
import os
import boto3
import requests
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''Миграция референсных изображений цветотипов в S3 хранилище'''
    
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
    
    # Get S3 credentials
    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    s3_bucket = os.environ.get('S3_BUCKET_NAME')
    
    if not all([s3_access_key, s3_secret_key, s3_bucket]):
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'S3 credentials not configured'})
        }
    
    # Load colortype references
    script_dir = os.path.dirname(os.path.abspath(__file__))
    refs_path = os.path.join(script_dir, 'colortype_references.json')
    
    with open(refs_path, 'r', encoding='utf-8') as f:
        refs = json.load(f)
    
    # Initialize S3
    s3 = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key,
        region_name='ru-central1'
    )
    
    migrated = 0
    failed = []
    new_refs = {}
    
    for colortype, data in refs.items():
        folder_name = colortype.lower().replace(' ', '-')
        new_data = data.copy()
        
        # Migrate scheme
        if 'scheme_url' in data:
            try:
                scheme_url = data['scheme_url']
                response = requests.get(scheme_url, timeout=30)
                response.raise_for_status()
                
                file_ext = 'jpg' if scheme_url.endswith('.jpg') else 'jpeg'
                s3_key = f"colortype-schemes/{folder_name}/scheme.{file_ext}"
                content_type = 'image/jpeg'
                
                s3.put_object(
                    Bucket=s3_bucket,
                    Key=s3_key,
                    Body=response.content,
                    ContentType=content_type,
                    ACL='public-read'
                )
                
                new_url = f"https://storage.yandexcloud.net/{s3_bucket}/{s3_key}"
                new_data['scheme_url'] = new_url
                migrated += 1
                
            except Exception as e:
                failed.append(f"{colortype}/scheme: {str(e)}")
                new_data['scheme_url'] = data['scheme_url']
        
        # Migrate examples
        if 'examples' in data:
            new_examples = []
            
            for idx, example_url in enumerate(data['examples'], 1):
                try:
                    response = requests.get(example_url, timeout=30)
                    response.raise_for_status()
                    
                    file_ext = 'webp' if example_url.endswith('.webp') else 'jpg'
                    s3_key = f"colortype-schemes/{folder_name}/example-{idx}.{file_ext}"
                    content_type = 'image/webp' if file_ext == 'webp' else 'image/jpeg'
                    
                    s3.put_object(
                        Bucket=s3_bucket,
                        Key=s3_key,
                        Body=response.content,
                        ContentType=content_type,
                        ACL='public-read'
                    )
                    
                    new_url = f"https://storage.yandexcloud.net/{s3_bucket}/{s3_key}"
                    new_examples.append(new_url)
                    migrated += 1
                    
                except Exception as e:
                    failed.append(f"{colortype}/example-{idx}: {str(e)}")
                    new_examples.append(example_url)
            
            new_data['examples'] = new_examples
        
        new_refs[colortype] = new_data
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'success': True,
            'migrated': migrated,
            'failed': len(failed),
            'failed_details': failed,
            'new_references': new_refs,
            'message': f'Successfully migrated {migrated} images to S3. Copy new_references to colortype_references.json'
        }, ensure_ascii=False)
    }