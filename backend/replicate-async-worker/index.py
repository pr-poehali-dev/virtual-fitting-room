import json
import os
import psycopg2
import replicate
from typing import Dict, Any
from datetime import datetime

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Process ONE pending Replicate task from queue
    Args: event - dict with httpMethod (cron trigger or manual)
          context - object with request_id attribute
    Returns: HTTP response with processing result
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
        garments = json.loads(garments_json)
        
        cursor.execute('''
            UPDATE replicate_tasks
            SET status = 'processing', updated_at = %s
            WHERE id = %s
        ''', (datetime.utcnow(), task_id))
        conn.commit()
        
        cursor.close()
        conn.close()
        
        os.environ['REPLICATE_API_TOKEN'] = api_token
        current_image = person_image
        
        for idx, garment in enumerate(garments):
            garment_image = garment.get('image') if isinstance(garment, dict) else garment
            garment_category = garment.get('category', 'upper_body') if isinstance(garment, dict) else 'upper_body'
            
            valid_categories = ['upper_body', 'lower_body', 'dresses', 'shoes']
            if garment_category not in valid_categories:
                garment_category = 'upper_body'
            
            input_data = {
                "human_img": current_image,
                "garm_img": garment_image,
                "category": garment_category,
            }
            
            if prompt_hints:
                input_data["garment_des"] = prompt_hints
            
            output = replicate.run(
                "cuuupid/idm-vton:c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4",
                input=input_data
            )
            current_image = output if isinstance(output, str) else str(output)
        
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE replicate_tasks
            SET status = 'completed', result_url = %s, updated_at = %s
            WHERE id = %s
        ''', (current_image, datetime.utcnow(), task_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'task_id': task_id,
                'status': 'completed',
                'result_url': current_image
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
            'body': json.dumps({'error': f'Processing failed: {str(e)}'})
        }
