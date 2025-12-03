import json
import os
import psycopg2
from typing import Dict, Any
import uuid
from datetime import datetime

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Start async NanoBanana generation and return task_id immediately
    Args: event - dict with httpMethod, body (person_image, garments, custom_prompt)
          context - object with request_id attribute
    Returns: HTTP response with task_id (no waiting)
    '''
    method: str = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    user_id = event.get('headers', {}).get('X-User-Id') or event.get('headers', {}).get('x-user-id')
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'User ID required'})
        }
    
    body_data = json.loads(event.get('body', '{}'))
    person_image = body_data.get('person_image')
    garments = body_data.get('garments', [])
    prompt_hints = body_data.get('custom_prompt', '')
    
    if not person_image:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'person_image is required'})
        }
    
    if not garments or len(garments) == 0:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'At least one garment is required'})
        }
    
    if len(garments) > 2:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Максимум 2 вещи за раз для NanoBanana'})
        }
    
    task_id = str(uuid.uuid4())
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO nanobananapro_tasks (id, user_id, status, person_image, garments, prompt_hints, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (
            task_id,
            user_id,
            'pending',
            person_image,
            json.dumps(garments),
            prompt_hints,
            datetime.utcnow()
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        try:
            import urllib.request
            worker_url = 'https://functions.poehali.dev/1f4c772e-0425-4fe4-98a6-baa3979ba94d'
            req = urllib.request.Request(worker_url, method='GET')
            urllib.request.urlopen(req, timeout=2)
        except:
            pass
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'task_id': task_id,
                'status': 'pending',
                'estimated_time_seconds': 30
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }