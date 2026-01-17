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
    
    # Colortype references embedded in code
    refs = {
        "VIBRANT SPRING": {
            "scheme_url": "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/cover_-bright-spring-1-1.jpg",
            "examples": [
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vibrant-spring1.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vibrant-spring2.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vibrant-spring3.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vibrant-spring4.webp"
            ]
        },
        "BRIGHT SPRING": {
            "scheme_url": "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/cover-warm-spring-1-1.jpg",
            "examples": [
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/bright-spring1.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/bright-spring2.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/bright-spring3.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/bright-spring4.webp"
            ]
        },
        "GENTLE SPRING": {
            "scheme_url": "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/cover-light-spring-2.jpg",
            "examples": [
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/gentle-spring1.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/gentle-spring2.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/gentle-spring3.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/gentle-spring4.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/gentle-spring5.webp"
            ]
        },
        "SOFT SUMMER": {
            "scheme_url": "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/cover-light-summer-2.jpg",
            "examples": [
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/soft-summer1.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/soft-summer2.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/soft-summer3.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/soft-summer4.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/soft-summer5.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/soft-summer6.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/soft-summer7.webp"
            ]
        },
        "VIVID SUMMER": {
            "scheme_url": "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/cover-cool-summer-2.jpg",
            "examples": [
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-summer1.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-summer2.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-summer3.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-summer4.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-summer5.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-summer6.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-summer7.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-summer8.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-summer9.webp"
            ]
        },
        "DUSTY SUMMER": {
            "scheme_url": "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/cover-soft-summer.jpg",
            "examples": [
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/dusty-summer1.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/dusty-summer2.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/dusty-summer3.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/dusty-summer4.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/dusty-summer5.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/dusty-summer6.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/dusty-summer7.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/dusty-summer8.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/dusty-summer9.webp"
            ]
        },
        "GENTLE AUTUMN": {
            "scheme_url": "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/cover-soft-autumn-1.jpg",
            "examples": [
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/gentle-autumn1.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/gentle-autumn2.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/gentle-autumn3.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/gentle-autumn4.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/gentle-autumn5.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/gentle-autumn6.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/gentle-autumn7.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/gentle-autumn8.webp"
            ]
        },
        "FIERY AUTUMN": {
            "scheme_url": "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/cover-warm-autumn-1.jpg",
            "examples": [
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/fiery-autumn1.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/fiery-autumn2.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/fiery-autumn3.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/fiery-autumn4.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/fiery-autumn5.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/fiery-autumn6.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/fiery-autumn7.webp"
            ]
        },
        "VIVID AUTUMN": {
            "scheme_url": "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/cover-dark-autumn-1.jpg",
            "examples": [
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-autumn1.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-autumn2.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-autumn3.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-autumn4.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-autumn5.webp"
            ]
        },
        "VIVID WINTER": {
            "scheme_url": "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/cover-dark-winter.jpg",
            "examples": [
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-winter1.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-winter2.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-winter3.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-winter4.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vivid-winter5.webp"
            ]
        },
        "SOFT WINTER": {
            "scheme_url": "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/cover-cool-winter.jpg",
            "examples": [
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/soft-winter1.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/soft-winter2.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/soft-winter3.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/soft-winter4.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/soft-winter5.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/soft-winter6.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/soft-winter7.webp"
            ]
        },
        "BRIGHT WINTER": {
            "scheme_url": "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/cover-bright-winter-.jpg",
            "examples": [
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/bright-winter1.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/bright-winter2.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/bright-winter3.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/bright-winter4.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/bright-winter5.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/bright-winter6.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/bright-winter7.webp",
                "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/bright-winter8.webp"
            ]
        }
    }
    
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