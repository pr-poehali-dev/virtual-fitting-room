"""
Скрипт для миграции референсных изображений в постоянное S3 хранилище
Запустить: python migrate_images.py
"""
import json
import os
import boto3
import requests
from urllib.parse import urlparse

def download_image(url: str) -> bytes:
    """Скачать изображение по URL"""
    print(f"Скачиваю: {url}")
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.content

def upload_to_s3(image_data: bytes, key: str, content_type: str) -> str:
    """Загрузить в S3 и вернуть CDN URL"""
    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    s3_bucket = os.environ.get('S3_BUCKET_NAME', 'fitting-room-images')
    
    if not s3_access_key or not s3_secret_key:
        raise Exception('Установите S3_ACCESS_KEY и S3_SECRET_KEY')
    
    s3 = boto3.client('s3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key
    )
    
    print(f"Загружаю в S3: {key}")
    s3.put_object(
        Bucket=s3_bucket,
        Key=key,
        Body=image_data,
        ContentType=content_type
    )
    
    cdn_url = f'https://storage.yandexcloud.net/{s3_bucket}/{key}'
    print(f"✅ Загружено: {cdn_url}")
    return cdn_url

def migrate_references():
    """Мигрировать все референсные изображения"""
    with open('colortype_references.json', 'r', encoding='utf-8') as f:
        refs = json.load(f)
    
    new_refs = {}
    
    for colortype, data in refs.items():
        print(f"\n=== {colortype} ===")
        
        new_data = data.copy()
        
        # Мигрировать схему
        scheme_url = data['scheme_url']
        filename = os.path.basename(urlparse(scheme_url).path)
        content_type = 'image/jpeg' if filename.endswith('.jpg') else 'image/webp'
        
        image_bytes = download_image(scheme_url)
        s3_key = f'colortype-references/schemes/{colortype.lower().replace(" ", "-")}/{filename}'
        new_scheme_url = upload_to_s3(image_bytes, s3_key, content_type)
        new_data['scheme_url'] = new_scheme_url
        
        # Мигрировать примеры
        new_examples = []
        for i, example_url in enumerate(data['examples'], 1):
            filename = os.path.basename(urlparse(example_url).path)
            content_type = 'image/jpeg' if filename.endswith('.jpg') else 'image/webp'
            
            image_bytes = download_image(example_url)
            s3_key = f'colortype-references/examples/{colortype.lower().replace(" ", "-")}/{filename}'
            new_example_url = upload_to_s3(image_bytes, s3_key, content_type)
            new_examples.append(new_example_url)
        
        new_data['examples'] = new_examples
        new_refs[colortype] = new_data
    
    # Сохранить обновлённый файл
    with open('colortype_references_migrated.json', 'w', encoding='utf-8') as f:
        json.dump(new_refs, f, ensure_ascii=False, indent=2)
    
    print("\n✅ Миграция завершена! Результат в colortype_references_migrated.json")
    print("Теперь замените colortype_references.json на colortype_references_migrated.json")

if __name__ == '__main__':
    migrate_references()
