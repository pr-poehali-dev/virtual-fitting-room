import json
import os
import psycopg2
import replicate
from typing import Dict, Any
from datetime import datetime

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Start Replicate prediction for ONE pending task (async, no waiting)
    Args: event - dict with httpMethod (cron trigger or manual)
          context - object with request_id attribute
    Returns: HTTP response with task_id and prediction_id
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    database_url = os.environ.get('DATABASE_URL')
    api_token = os.environ.get('REPLICATE_API_TOKEN')
    
    if not database_url or not api_token:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL or REPLICATE_API_TOKEN not configured'})
        }
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, person_image, garments, prompt_hints
            FROM replicate_tasks
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 1
        ''')
        
        row = cursor.fetchone()
        
        if not row:
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'isBase64Encoded': False,
                'body': json.dumps({'message': 'No pending tasks'})
            }
        
        task_id, person_image, garments_json, prompt_hints = row
        
        if not person_image or not isinstance(person_image, str) or len(person_image) < 50:
            raise ValueError('Person image is required and must be valid base64')
        
        garments = json.loads(garments_json)
        total_steps = len(garments)
        
        first_garment = garments[0]
        garment_image = first_garment.get('image') if isinstance(first_garment, dict) else first_garment
        garment_category = first_garment.get('category', 'upper_body') if isinstance(first_garment, dict) else 'upper_body'
        
        if not garment_image or not isinstance(garment_image, str) or len(garment_image) < 50:
            raise ValueError('Garment image is required and must be valid base64')
        
        valid_categories = ['upper_body', 'lower_body', 'dresses']
        if not garment_category or garment_category == '' or garment_category not in valid_categories:
            garment_category = 'upper_body'
        
        input_data = {
            "human_img": person_image,
            "garm_img": garment_image,
            "category": str(garment_category),
            "garment_des": ""
        }
        
        if prompt_hints and isinstance(prompt_hints, str) and prompt_hints.strip():
            input_data["garment_des"] = prompt_hints.strip()
        
        client = replicate.Client(api_token=api_token)
        
        prediction = client.predictions.create(
            version="c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4",
            input=input_data
        )
        
        cursor.execute('''
            UPDATE replicate_tasks
            SET status = 'processing', 
                prediction_id = %s,
                current_step = 1,
                total_steps = %s,
                updated_at = %s
            WHERE id = %s
        ''', (prediction.id, total_steps, datetime.utcnow(), task_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'task_id': task_id,
                'prediction_id': prediction.id,
                'status': 'started',
                'step': f'1/{total_steps}'
            })
        }
        
    except Exception as e:
        try:
            conn = psycopg2.connect(database_url)
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE replicate_tasks
                SET status = 'failed', error_message = %s, updated_at = %s
                WHERE id = %s
            ''', (str(e), datetime.utcnow(), task_id))
            
            conn.commit()
            cursor.close()
            conn.close()
        except:
            pass
        
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Failed to start prediction: {str(e)}'})
        }