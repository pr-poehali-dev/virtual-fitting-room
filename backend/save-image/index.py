'''
Business: Save images from external URLs to project folder with unique filenames
Args: event with httpMethod, body containing image_url, folder (catalog/lookbooks), user_id
Returns: HTTP response with local image path
'''

import json
import os
import base64
import requests
from datetime import datetime
from typing import Dict, Any
from pathlib import Path


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
    
    # Generate unique filename: YYYYMMDD_HHMMSS_userid
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Determine file extension
    file_ext = '.jpg'
    if image_url.startswith('data:image/'):
        if 'png' in image_url:
            file_ext = '.png'
        elif 'webp' in image_url:
            file_ext = '.webp'
    elif '.' in image_url.split('/')[-1]:
        url_ext = image_url.split('/')[-1].split('.')[-1].split('?')[0].lower()
        if url_ext in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
            file_ext = f'.{url_ext}'
    
    filename = f'{timestamp}_{user_id}{file_ext}'
    
    # GitHub API setup
    github_token = os.environ.get('GITHUB_TOKEN')
    github_repo = os.environ.get('GITHUB_REPO')
    github_branch = os.environ.get('GITHUB_BRANCH', 'main')
    
    if not github_token or not github_repo:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'GitHub not configured'})
        }
    
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
    
    # Upload to GitHub
    file_path = f'public/images/{folder}/{filename}'
    github_api_url = f'https://api.github.com/repos/{github_repo}/contents/{file_path}'
    
    # Check if file exists
    check_response = requests.get(
        github_api_url,
        headers={
            'Authorization': f'token {github_token}',
            'Accept': 'application/vnd.github.v3+json'
        }
    )
    
    sha = None
    if check_response.status_code == 200:
        sha = check_response.json().get('sha')
    
    # Upload file
    upload_data = {
        'message': f'Add image {filename}',
        'content': base64.b64encode(image_data).decode('utf-8'),
        'branch': github_branch
    }
    
    if sha:
        upload_data['sha'] = sha
    
    upload_response = requests.put(
        github_api_url,
        headers={
            'Authorization': f'token {github_token}',
            'Accept': 'application/vnd.github.v3+json'
        },
        json=upload_data
    )
    
    if upload_response.status_code not in [200, 201]:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Failed to upload to GitHub'})
        }
    
    # Return relative path
    relative_path = f'/images/{folder}/{filename}'
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'isBase64Encoded': False,
        'body': json.dumps({'url': relative_path, 'filename': filename})
    }
