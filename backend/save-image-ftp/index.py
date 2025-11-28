'''
Business: Save images to hosting via SFTP with unique filenames
Args: event with httpMethod, body containing image_url, folder (catalog/lookbooks), user_id
Returns: HTTP response with public image URL
'''

import json
import os
import base64
import requests
from datetime import datetime
from typing import Dict, Any
from io import BytesIO
import paramiko


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Admin-Password',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    body_str = event.get('body', '{}')
    body_data = json.loads(body_str)
    
    image_url = body_data.get('image_url')
    folder = body_data.get('folder', 'catalog')
    user_id = body_data.get('user_id', 'guest')
    
    if not image_url:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Missing image_url'})
        }
    
    if folder not in ['catalog', 'lookbooks']:
        folder = 'catalog'
    
    # Get SFTP credentials from environment
    sftp_host = os.environ.get('FTP_HOST')
    sftp_user = os.environ.get('FTP_USER')
    sftp_password = os.environ.get('FTP_PASSWORD')
    sftp_base_path = os.environ.get('FTP_BASE_PATH', '/public_html')
    site_url = os.environ.get('SITE_URL', '')
    
    if not sftp_host or not sftp_user or not sftp_password:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'SFTP not configured'})
        }
    
    # Generate unique filename: YYYYMMDD_HHMMSS_userid
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Determine file extension
    file_ext = '.jpg'
    if image_url.startswith('data:image/'):
        if 'png' in image_url:
            file_ext = '.png'
        elif 'webp' in image_url:
            file_ext = '.webp'
        elif 'gif' in image_url:
            file_ext = '.gif'
    elif '.' in image_url.split('/')[-1]:
        url_ext = image_url.split('/')[-1].split('.')[-1].split('?')[0].lower()
        if url_ext in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
            file_ext = f'.{url_ext}'
    
    filename = f'{timestamp}_{user_id}{file_ext}'
    
    # Download image
    if image_url.startswith('data:'):
        header, encoded = image_url.split(',', 1)
        image_data = base64.b64decode(encoded)
    else:
        response = requests.get(image_url, timeout=30)
        if response.status_code != 200:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Failed to download image'})
            }
        image_data = response.content
    
    # Upload via SFTP
    try:
        # Parse host and port
        sftp_port = 22
        if ':' in sftp_host:
            host_parts = sftp_host.split(':')
            sftp_host = host_parts[0]
            sftp_port = int(host_parts[1])
        
        print(f'Connecting to SFTP: {sftp_host}:{sftp_port}')
        
        # Create SSH client
        transport = paramiko.Transport((sftp_host, sftp_port))
        transport.connect(username=sftp_user, password=sftp_password)
        print('SFTP connected and authenticated')
        
        # Create SFTP client
        sftp = paramiko.SFTPClient.from_transport(transport)
        print('SFTP client created')
        
        # Build full remote path
        remote_path = f'{sftp_base_path}/images/{folder}/{filename}'
        print(f'Uploading to: {remote_path}')
        
        # Upload file
        bio = BytesIO(image_data)
        sftp.putfo(bio, remote_path)
        print(f'File uploaded successfully')
        
        # Close connections
        sftp.close()
        transport.close()
        
        # Construct public URL
        if site_url:
            # Ensure site_url has protocol
            if not site_url.startswith(('http://', 'https://')):
                site_url = f'https://{site_url}'
            public_url = f'{site_url.rstrip("/")}/images/{folder}/{filename}'
        else:
            public_url = f'/images/{folder}/{filename}'
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'url': public_url, 'filename': filename})
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'SFTP upload failed: {str(e)}'})
        }