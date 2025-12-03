import json
import os
import psycopg2
import replicate
import requests
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
            SELECT id, person_image, garments, prompt_hints, prediction_id, current_step, total_steps, user_id
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
            task_id, person_image, garments_json, prompt_hints, prediction_id, current_step, total_steps, user_id = row
            garments = json.loads(garments_json)
            
            prediction = client.predictions.get(prediction_id)
            
            if prediction.status == 'succeeded':
                output_url = prediction.output if isinstance(prediction.output, str) else str(prediction.output)
                
                # Keep original Replicate URL (no S3 save here)
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
                    cursor.execute('''
                        UPDATE replicate_tasks
                        SET status = 'completed',
                            result_url = %s,
                            prediction_id = NULL,
                            updated_at = %s
                        WHERE id = %s
                    ''', (output_url, datetime.utcnow(), task_id))
                    
                    # Save to history with model and cost info
                    print(f'[Replicate] Attempting to save task {task_id} to history for user {user_id}')
                    try:
                        history_payload = {
                            'person_image': person_image,
                            'garments': garments,
                            'result_image': output_url,
                            'model_used': 'replicate',
                            'cost': 0
                        }
                        print(f'[Replicate] History payload: model_used={history_payload["model_used"]}, result_url={output_url[:50]}...')
                        
                        history_response = requests.post(
                            'https://functions.poehali.dev/8436b2bf-ae39-4d91-b2b7-91951b4235cd',
                            headers={'X-User-Id': user_id},
                            json=history_payload,
                            timeout=10
                        )
                        print(f'[Replicate] History API response: status={history_response.status_code}, body={history_response.text[:200]}')
                        if history_response.status_code == 201:
                            print(f'[Replicate] ✓ Successfully saved to history: task {task_id}')
                        else:
                            print(f'[Replicate] ✗ History API returned non-201: {history_response.status_code}')
                    except Exception as e:
                        print(f'[Replicate] ✗ Failed to save to history: {type(e).__name__}: {str(e)}')
                
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