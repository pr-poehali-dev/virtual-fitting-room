'''
Business: Delete images from hosting via SFTP
Args: event with httpMethod, body containing image_url or filename
Returns: HTTP response confirming deletion
'''

import json
import os
from typing import Dict, Any
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
        
        # Build full SFTP path
        full_sftp_path = f'{sftp_base_path}/{path_part}'
        print(f'Deleting file: {full_sftp_path}')
        
        # Delete file
        sftp.remove(full_sftp_path)
        print('File deleted successfully')
        
        # Close connections
        sftp.close()
        transport.close()
        
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
            'body': json.dumps({'error': f'SFTP deletion failed: {str(e)}'})
        }