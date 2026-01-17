import json
import os
import boto3
from io import BytesIO
from typing import Dict, Any
from PIL import Image, ImageDraw, ImageFont

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''Загрузка плейсхолдеров в папки цветотипов в S3'''
    
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
        ('vibrant-spring', '#FFB6C1'),
        ('bright-spring', '#FFD700'),
        ('gentle-spring', '#E6F3E6'),
        ('soft-summer', '#B0C4DE'),
        ('vivid-summer', '#87CEEB'),
        ('dusty-summer', '#C8B4C0'),
        ('gentle-autumn', '#D4A574'),
        ('fiery-autumn', '#FF6347'),
        ('vivid-autumn', '#8B4513'),
        ('vivid-winter', '#1C1C3C'),
        ('soft-winter', '#B0B0C8'),
        ('bright-winter', '#E0E0FF')
    ]
    
    uploaded = []
    
    for colortype, color in colortypes:
        img = Image.new('RGB', (400, 300), color)
        draw = ImageDraw.Draw(img)
        
        text = f'{colortype}\nplaceholder'
        bbox = draw.textbbox((0, 0), text)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        x = (400 - text_width) // 2
        y = (300 - text_height) // 2
        draw.text((x, y), text, fill='#333333')
        
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=85)
        buffer.seek(0)
        
        key = f'colortype-schemes/{colortype}/placeholder.jpg'
        
        try:
            s3.put_object(
                Bucket=s3_bucket,
                Key=key,
                Body=buffer.getvalue(),
                ContentType='image/jpeg'
            )
            uploaded.append(colortype)
            print(f'Uploaded placeholder: {key}')
            
        except Exception as e:
            print(f'Error uploading {colortype}: {str(e)}')
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'success': True,
            'uploaded': len(uploaded),
            'colortypes': uploaded,
            'message': f'Загружено {len(uploaded)} плейсхолдеров в colortype-schemes/'
        }, ensure_ascii=False)
    }