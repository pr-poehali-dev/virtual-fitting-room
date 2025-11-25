import json
import os
import psycopg2
import replicate
from typing import Dict, Any
from datetime import datetime

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Check status of async Replicate task
    Args: event - dict with httpMethod, queryStringParameters (task_id)
          context - object with request_id attribute
    Returns: HTTP response with task status and result_url if completed
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'GET':
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
    
    params = event.get('queryStringParameters', {}) or {}
    task_id = params.get('task_id')
    force_check = params.get('force_check', 'false').lower() == 'true'
    
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
            SELECT status, result_url, error_message, created_at, updated_at, current_step, total_steps, intermediate_result, prediction_id
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
        
        status, result_url, error_message, created_at, updated_at, current_step, total_steps, intermediate_result, prediction_id = row
        
        # Если force_check=true и статус processing, проверяем Replicate API
        if force_check and status == 'processing' and prediction_id:
            api_token = os.environ.get('REPLICATE_API_TOKEN')
            if api_token:
                try:
                    client = replicate.Client(api_token=api_token)
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
                            status = 'waiting_continue'
                            intermediate_result = output_url
                        else:
                            cursor.execute('''
                                UPDATE replicate_tasks
                                SET status = 'completed',
                                    result_url = %s,
                                    prediction_id = NULL,
                                    updated_at = %s
                                WHERE id = %s
                            ''', (output_url, datetime.utcnow(), task_id))
                            status = 'completed'
                            result_url = output_url
                        
                        conn.commit()
                        
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
                        status = 'failed'
                        error_message = error_msg
                        conn.commit()
                        
                except Exception as e:
                    print(f'Force check error: {e}')
        
        cursor.close()
        conn.close()
        
        response_data = {
            'task_id': task_id,
            'status': status,
            'current_step': current_step or 0,
            'total_steps': total_steps or 0,
            'created_at': created_at.isoformat() if created_at else None,
            'updated_at': updated_at.isoformat() if updated_at else None
        }
        
        if status == 'completed' and result_url:
            response_data['result_url'] = result_url
        
        if status == 'waiting_continue' and intermediate_result:
            response_data['intermediate_result'] = intermediate_result
        
        if status == 'failed' and error_message:
            response_data['error_message'] = error_message
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps(response_data)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }