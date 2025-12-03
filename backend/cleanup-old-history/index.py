import json
import os
from typing import Dict, Any
from datetime import datetime, timedelta
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
    Business: Auto-delete history items older than 6 months and their photos from S3
    Args: event - dict with httpMethod (cron trigger)
          context - object with attributes: request_id, function_name
    Returns: HTTP response with cleanup stats
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
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Calculate date 6 months ago
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        six_months_str = six_months_ago.strftime('%Y-%m-%d %H:%M:%S')
        
        # Find old history items (older than 6 months)
        cursor.execute(
            f"SELECT id, user_id, result_image FROM try_on_history WHERE created_at < '{six_months_str}'"
        )
        old_items = cursor.fetchall()
        
        if not old_items:
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'message': 'No old items to clean', 'deleted': 0})
            }
        
        s3_bucket_name = os.environ.get('S3_BUCKET_NAME')
        s3_url_prefix = f'https://{s3_bucket_name}.storage.yandexcloud.net/'
        
        deleted_count = 0
        s3_deleted_count = 0
        
        for item in old_items:
            item_id = item['id']
            user_id = item['user_id']
            result_image = item['result_image']
            
            # Check if photo exists in any lookbook for this user
            cursor.execute(
                f"SELECT COUNT(*) as count FROM lookbooks WHERE user_id = '{user_id}' AND '{result_image.replace(chr(39), chr(39)+chr(39))}' = ANY(photos)"
            )
            lookbook_count = cursor.fetchone()['count']
            
            # Delete from history
            cursor.execute(
                f"DELETE FROM try_on_history WHERE id = '{item_id}'"
            )
            deleted_count += 1
            
            # If photo is NOT in any lookbook, delete from S3
            if lookbook_count == 0 and result_image.startswith(s3_url_prefix):
                try:
                    s3_key = result_image.replace(s3_url_prefix, '')
                    
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
                    s3_deleted_count += 1
                    print(f'Deleted from S3 (6 months old, not in lookbooks): {s3_key}')
                except Exception as e:
                    print(f'Failed to delete from S3: {e}')
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({
                'message': f'Cleaned up {deleted_count} old history items',
                'deleted_from_history': deleted_count,
                'deleted_from_s3': s3_deleted_count
            })
        }
        
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Cleanup failed: {str(e)}'})
        }
