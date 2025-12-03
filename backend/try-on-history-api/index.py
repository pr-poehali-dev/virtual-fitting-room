import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.config import Config

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: CRUD operations for try-on history
    Args: event - dict with httpMethod, body
          context - object with attributes: request_id, function_name
    Returns: HTTP response with history data
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        headers = event.get('headers', {})
        user_id = headers.get('x-user-id') or headers.get('X-User-Id')
        
        if not user_id:
            return {
                'statusCode': 401,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Unauthorized - User ID required'})
            }
        
        if method == 'GET':
            cursor.execute(
                f"SELECT * FROM try_on_history WHERE user_id = '{user_id}' ORDER BY created_at DESC LIMIT 50"
            )
            history = cursor.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps([{
                    'id': str(h['id']),
                    'person_image': h['person_image'],
                    'garment_image': h['garment_image'],
                    'result_image': h['result_image'],
                    'created_at': h['created_at'].isoformat(),
                    'model_used': h.get('model_used'),
                    'saved_to_lookbook': h.get('saved_to_lookbook', False),
                    'cost': float(h.get('cost', 0))
                } for h in history])
            }
        
        elif method == 'POST':
            body_str = event.get('body', '{}')
            body_data = json.loads(body_str)
            
            person_image = body_data.get('person_image')
            garments = body_data.get('garments')
            result_image = body_data.get('result_image')
            model_used = body_data.get('model_used', 'unknown')
            cost = body_data.get('cost', 0)
            
            if not person_image or not result_image:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing required fields'})
                }
            
            person_image_escaped = person_image.replace("'", "''")
            result_image_escaped = result_image.replace("'", "''")
            model_used_escaped = model_used.replace("'", "''")
            
            if garments and isinstance(garments, list):
                garments_json = json.dumps(garments).replace("'", "''")
                garment_image_escaped = garments[0]['image'] if len(garments) > 0 else ''
                garment_image_escaped = garment_image_escaped.replace("'", "''")
            else:
                garment_image = body_data.get('garment_image', '')
                garment_image_escaped = garment_image.replace("'", "''")
                garments_json = json.dumps([{'image': garment_image}]).replace("'", "''")
            
            cursor.execute(
                f"""
                INSERT INTO try_on_history (person_image, garment_image, result_image, user_id, garments, model_used, cost, saved_to_lookbook)
                VALUES ('{person_image_escaped}', '{garment_image_escaped}', '{result_image_escaped}', '{user_id}', '{garments_json}', '{model_used_escaped}', {cost}, false)
                RETURNING id, person_image, garment_image, result_image, created_at, model_used, cost, saved_to_lookbook
                """
            )
            
            history_item = cursor.fetchone()
            conn.commit()
            
            return {
                'statusCode': 201,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'id': str(history_item['id']),
                    'person_image': history_item['person_image'],
                    'garment_image': history_item['garment_image'],
                    'result_image': history_item['result_image'],
                    'created_at': history_item['created_at'].isoformat(),
                    'model_used': history_item.get('model_used'),
                    'cost': float(history_item.get('cost', 0)),
                    'saved_to_lookbook': history_item.get('saved_to_lookbook', False)
                })
            }
        
        elif method == 'DELETE':
            query_params = event.get('queryStringParameters') or {}
            history_id = query_params.get('id')
            
            if not history_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing id'})
                }
            
            # Get result_image before deletion to check if it should be deleted from storage
            cursor.execute(
                f"SELECT result_image FROM try_on_history WHERE id = '{history_id}' AND user_id = '{user_id}'"
            )
            history_item = cursor.fetchone()
            
            if not history_item:
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'History item not found'})
                }
            
            result_image_url = history_item['result_image']
            
            # Check if this photo exists in any lookbook
            cursor.execute(
                f"""SELECT COUNT(*) as count FROM lookbooks 
                WHERE user_id = '{user_id}' AND '{result_image_url}' = ANY(photos)"""
            )
            lookbook_count = cursor.fetchone()['count']
            
            # Delete from history
            cursor.execute(
                f"DELETE FROM try_on_history WHERE id = '{history_id}' AND user_id = '{user_id}' RETURNING id"
            )
            
            deleted = cursor.fetchone()
            
            if not deleted:
                conn.rollback()
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'History item not found'})
                }
            
            conn.commit()
            
            # If photo is NOT in any lookbook, delete from S3
            if lookbook_count == 0:
                s3_bucket_name = os.environ.get('S3_BUCKET_NAME')
                s3_url_prefix = f'https://{s3_bucket_name}.storage.yandexcloud.net/'
                
                if result_image_url.startswith(s3_url_prefix):
                    try:
                        s3_key = result_image_url.replace(s3_url_prefix, '')
                        
                        s3_client = boto3.client(
                            's3',
                            endpoint_url='https://storage.yandexcloud.net',
                            aws_access_key_id=os.environ.get('S3_ACCESS_KEY'),
                            aws_secret_access_key=os.environ.get('S3_SECRET_KEY'),
                            region_name='ru-central1',
                            config=Config(signature_version='s3v4')
                        )
                        
                        s3_client.delete_object(
                            Bucket=s3_bucket_name,
                            Key=s3_key
                        )
                        print(f'Deleted from S3: {s3_key}')
                    except Exception as e:
                        print(f'Failed to delete from S3: {e}')
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'message': 'History item deleted successfully'})
            }
        
        else:
            return {
                'statusCode': 405,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Method not allowed'})
            }
    
    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        cursor.close()
        conn.close()