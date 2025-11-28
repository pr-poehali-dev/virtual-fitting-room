'''
Business: Delete images from hosting via FTP
Args: event with httpMethod, body containing image_url or filename
Returns: HTTP response confirming deletion
'''

import json
import os
from typing import Dict, Any
from ftplib import FTP


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
    if not body_str:
        body_str = '{}'
    body_data = json.loads(body_str)
    
    image_url = body_data.get('image_url')
    
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
    
    # Get FTP credentials from environment
    ftp_host = os.environ.get('FTP_HOST')
    ftp_user = os.environ.get('FTP_USER')
    ftp_password = os.environ.get('FTP_PASSWORD')
    ftp_base_path = os.environ.get('FTP_BASE_PATH', '/public_html')
    site_url = os.environ.get('SITE_URL', '')
    
    if not ftp_host or not ftp_user or not ftp_password:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'FTP not configured'})
        }
    
    # Ensure site_url has protocol
    if site_url and not site_url.startswith(('http://', 'https://')):
        site_url = f'https://{site_url}'
    
    # Only delete if image is from our hosting
    if not site_url or not image_url.startswith(site_url):
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'message': 'Not our hosting, skipping deletion'})
        }
    
    # Extract path from URL: https://fitting-room.ru/images/lookbooks/file.jpg -> images/lookbooks/file.jpg
    try:
        path_part = image_url.replace(site_url, '').lstrip('/')
        if not path_part.startswith('images/'):
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Invalid image path'})
            }
        
        # Parse host and port
        ftp_port = 21
        if ':' in ftp_host:
            host_parts = ftp_host.split(':')
            ftp_host = host_parts[0]
            ftp_port = int(host_parts[1])
        
        print(f'Connecting to FTP: {ftp_host}:{ftp_port}')
        ftp = FTP()
        ftp.connect(ftp_host, ftp_port, timeout=30)
        print('FTP connected, logging in...')
        ftp.login(ftp_user, ftp_password)
        print('FTP logged in successfully')
        ftp.set_pasv(True)
        print('FTP passive mode enabled')
        
        # Build full FTP path
        full_ftp_path = f'{ftp_base_path}/{path_part}'
        print(f'Deleting file: {full_ftp_path}')
        
        # Delete file
        ftp.delete(full_ftp_path)
        print('File deleted successfully')
        ftp.quit()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'message': 'File deleted successfully'})
        }
    
    except Exception as e:
        print(f'Deletion error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'FTP deletion failed: {str(e)}'})
        }