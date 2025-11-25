import json
import os
import psycopg2
import replicate
from typing import Dict, Any
from datetime import datetime

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Check Replicate predictions and set waiting_continue status (manual control)
    Args: event - dict with httpMethod (cron trigger every 10-30 sec)
          context - object with request_id attribute
    Returns: HTTP response with checked tasks count
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
            SELECT id, person_image, garments, prompt_hints, prediction_id, current_step, total_steps
            FROM replicate_tasks
            WHERE status = 'processing' AND prediction_id IS NOT NULL
            ORDER BY created_at ASC
        ''')
        
        rows = cursor.fetchall()
        
        if not rows:
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'isBase64Encoded': False,
                'body': json.dumps({'message': 'No processing tasks', 'checked': 0})
            }
        
        client = replicate.Client(api_token=api_token)
        checked_count = 0
        
        for row in rows:
            task_id, person_image, garments_json, prompt_hints, prediction_id, current_step, total_steps = row
            garments = json.loads(garments_json)
            
            prediction = client.predictions.get(prediction_id)
            
            if prediction.status == 'succeeded':
                output_url = prediction.output if isinstance(prediction.output, str) else str(prediction.output)
                
                if current_step < total_steps:
                    cursor.execute('''
                        UPDATE replicate_tasks
                        SET status = 'waiting_continue',
                            intermediate_result = %s,
                            prediction_id = NULL,
                            updated_at = %s
                        WHERE id = %s
                    ''', (output_url, datetime.utcnow(), task_id))
                    
                else:
                    if prompt_hints and prompt_hints.strip():
                        bg_prediction = client.predictions.create(
                            version="f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
                            input={
                                "image": output_url,
                                "prompt": prompt_hints,
                                "negative_prompt": "low quality, blurry, pixelated",
                                "num_inference_steps": 20,
                                "guidance_scale": 7.5
                            }
                        )
                        
                        cursor.execute('''
                            UPDATE replicate_tasks
                            SET status = 'processing',
                                prediction_id = %s,
                                current_step = %s,
                                updated_at = %s
                            WHERE id = %s
                        ''', (bg_prediction.id, total_steps + 1, datetime.utcnow(), task_id))
                    else:
                        cursor.execute('''
                            UPDATE replicate_tasks
                            SET status = 'completed',
                                result_url = %s,
                                prediction_id = NULL,
                                updated_at = %s
                            WHERE id = %s
                        ''', (output_url, datetime.utcnow(), task_id))
                
                checked_count += 1
                
            elif prediction.status == 'failed':
                error_msg = prediction.error if hasattr(prediction, 'error') else 'Prediction failed'
                
                cursor.execute('''
                    UPDATE replicate_tasks
                    SET status = 'failed',
                        error_message = %s,
                        prediction_id = NULL,
                        updated_at = %s
                    WHERE id = %s
                ''', (error_msg, datetime.utcnow(), task_id))
                
                checked_count += 1
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'message': f'Checked {checked_count} predictions',
                'checked': checked_count
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Checker failed: {str(e)}'})
        }