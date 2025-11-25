import json
import os
import psycopg2
import replicate
from typing import Dict, Any
from datetime import datetime

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Continue multi-step Replicate task to next garment
    Args: event - dict with httpMethod POST, body with task_id
          context - object with request_id attribute
    Returns: HTTP response confirming next step started
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
    api_token = os.environ.get('REPLICATE_API_TOKEN')
    
    if not database_url or not api_token:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL or REPLICATE_API_TOKEN not configured'})
        }
    
    body_data = json.loads(event.get('body', '{}'))
    task_id = body_data.get('task_id')
    
    if not task_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'task_id is required'})
        }
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT status, intermediate_result, garments, prompt_hints, current_step, total_steps
            FROM replicate_tasks
            WHERE id = %s
        ''', (task_id,))
        
        row = cursor.fetchone()
        
        if not row:
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Task not found'})
            }
        
        status, intermediate_result, garments_json, prompt_hints, current_step, total_steps = row
        
        if status != 'waiting_continue':
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': f'Cannot continue task with status: {status}'})
            }
        
        if not intermediate_result:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'No intermediate result to continue from'})
            }
        
        garments = json.loads(garments_json)
        
        if current_step >= total_steps:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'All steps completed'})
            }
        
        next_garment = garments[current_step]
        garment_image = next_garment.get('image') if isinstance(next_garment, dict) else next_garment
        garment_category = next_garment.get('category', 'upper_body') if isinstance(next_garment, dict) else 'upper_body'
        
        if not garment_image:
            raise ValueError('Garment image is required')
        
        valid_categories = ['upper_body', 'lower_body', 'dresses']
        if not garment_category or garment_category not in valid_categories:
            garment_category = 'upper_body'
        
        input_data = {
            "human_img": intermediate_result,
            "garm_img": garment_image,
            "category": garment_category,
        }
        
        if prompt_hints and prompt_hints.strip():
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
                current_step = %s,
                updated_at = %s
            WHERE id = %s
        ''', (prediction.id, current_step + 1, datetime.utcnow(), task_id))
        
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
                'status': 'processing',
                'step': f'{current_step + 1}/{total_steps}'
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Failed to continue: {str(e)}'})
        }