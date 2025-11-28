import json
import os
from typing import Dict, Any, List
import psycopg2
from psycopg2.extras import RealDictCursor
import requests

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: CRUD operations for lookbooks
    Args: event - dict with httpMethod, body, queryStringParameters
          context - object with attributes: request_id, function_name
    Returns: HTTP response with lookbook data
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
        
        if method == 'GET':
            query_params = event.get('queryStringParameters') or {}
            lookbook_id = query_params.get('id')
            share_token = query_params.get('share_token')
            
            if share_token:
                cursor.execute(
                    "SELECT * FROM lookbooks WHERE share_token = %s AND is_public = true",
                    (share_token,)
                )
                lookbook = cursor.fetchone()
                
                if not lookbook:
                    return {
                        'statusCode': 404,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Lookbook not found or not public'})
                    }
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'id': str(lookbook['id']),
                        'name': lookbook['name'],
                        'person_name': lookbook['person_name'],
                        'photos': lookbook['photos'] or [],
                        'color_palette': lookbook['color_palette'] or [],
                        'created_at': lookbook['created_at'].isoformat(),
                        'updated_at': lookbook['updated_at'].isoformat()
                    })
                }
            
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
            
            if lookbook_id:
                cursor.execute(
                    "SELECT * FROM lookbooks WHERE id = %s AND user_id = %s",
                    (lookbook_id, user_id)
                )
                lookbook = cursor.fetchone()
                
                if not lookbook:
                    return {
                        'statusCode': 404,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Lookbook not found'})
                    }
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'id': str(lookbook['id']),
                        'name': lookbook['name'],
                        'person_name': lookbook['person_name'],
                        'photos': lookbook['photos'] or [],
                        'color_palette': lookbook['color_palette'] or [],
                        'is_public': lookbook.get('is_public', False),
                        'share_token': lookbook.get('share_token'),
                        'created_at': lookbook['created_at'].isoformat(),
                        'updated_at': lookbook['updated_at'].isoformat()
                    })
                }
            else:
                cursor.execute(
                    "SELECT * FROM lookbooks WHERE user_id = %s ORDER BY created_at DESC",
                    (user_id,)
                )
                lookbooks = cursor.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps([{
                        'id': str(lb['id']),
                        'name': lb['name'],
                        'person_name': lb['person_name'],
                        'photos': lb['photos'] or [],
                        'color_palette': lb['color_palette'] or [],
                        'is_public': lb.get('is_public', False),
                        'share_token': lb.get('share_token'),
                        'created_at': lb['created_at'].isoformat(),
                        'updated_at': lb['updated_at'].isoformat()
                    } for lb in lookbooks])
                }
        
        elif method == 'POST':
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
            
            body_str = event.get('body', '{}')
            body_data = json.loads(body_str)
            
            name = body_data.get('name')
            person_name = body_data.get('person_name')
            photos = body_data.get('photos', [])
            color_palette = body_data.get('color_palette', [])
            
            if not name or not person_name:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing name or person_name'})
                }
            
            # Save photos to S3
            saved_photos = []
            s3_enabled = os.environ.get('S3_ACCESS_KEY')
            s3_bucket_name = os.environ.get('S3_BUCKET_NAME')
            s3_url_prefix = f'https://{s3_bucket_name}.storage.yandexcloud.net/'
            
            for photo in photos:
                # Skip if already in our S3
                if s3_enabled and photo.startswith(s3_url_prefix):
                    print(f'Photo already in S3, skipping: {photo}')
                    saved_photos.append(photo)
                elif photo.startswith(('http://', 'https://', 'data:')) and s3_enabled:
                    try:
                        save_response = requests.post(
                            'https://functions.poehali.dev/56814ab9-6cba-4035-a63d-423ac0d301c8',
                            json={
                                'image_url': photo,
                                'folder': 'lookbooks',
                                'user_id': str(user_id)
                            },
                            timeout=30
                        )
                        print(f'S3 save response: {save_response.status_code}, body: {save_response.text}')
                        if save_response.status_code == 200:
                            save_data = save_response.json()
                            new_url = save_data.get('url', photo)
                            print(f'Got new URL: {new_url}')
                            saved_photos.append(new_url)
                        else:
                            print(f'S3 save failed with status {save_response.status_code}')
                            saved_photos.append(photo)
                    except Exception as e:
                        print(f'S3 save exception: {str(e)}')
                        saved_photos.append(photo)
                else:
                    saved_photos.append(photo)
            
            cursor.execute(
                """
                INSERT INTO lookbooks (name, person_name, photos, color_palette, user_id)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, name, person_name, photos, color_palette, created_at, updated_at
                """,
                (name, person_name, saved_photos, color_palette, user_id)
            )
            
            lookbook = cursor.fetchone()
            conn.commit()
            
            return {
                'statusCode': 201,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'id': str(lookbook['id']),
                    'name': lookbook['name'],
                    'person_name': lookbook['person_name'],
                    'photos': lookbook['photos'] or [],
                    'color_palette': lookbook['color_palette'] or [],
                    'created_at': lookbook['created_at'].isoformat(),
                    'updated_at': lookbook['updated_at'].isoformat()
                })
            }
        
        elif method == 'PUT':
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
            
            body_str = event.get('body', '{}')
            body_data = json.loads(body_str)
            
            lookbook_id = body_data.get('id')
            name = body_data.get('name')
            person_name = body_data.get('person_name')
            photos = body_data.get('photos')
            color_palette = body_data.get('color_palette')
            is_public = body_data.get('is_public')
            share_token = body_data.get('share_token')
            
            if not lookbook_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing id'})
                }
            
            # Get old photos to detect deletions
            old_photos = []
            if photos:
                cursor.execute(
                    "SELECT photos FROM lookbooks WHERE id = %s AND user_id = %s",
                    (lookbook_id, user_id)
                )
                old_lookbook = cursor.fetchone()
                if old_lookbook:
                    old_photos = old_lookbook['photos'] or []
            
            # Save new photos to S3
            saved_photos = photos
            if photos:
                saved_photos = []
                s3_enabled = os.environ.get('S3_ACCESS_KEY')
                s3_bucket_name = os.environ.get('S3_BUCKET_NAME')
                s3_url_prefix = f'https://{s3_bucket_name}.storage.yandexcloud.net/'
                
                for photo in photos:
                    # Skip if already in our S3
                    if s3_enabled and photo.startswith(s3_url_prefix):
                        print(f'Photo already in S3 (PUT), skipping: {photo}')
                        saved_photos.append(photo)
                    elif photo.startswith(('http://', 'https://', 'data:')) and s3_enabled:
                        try:
                            save_response = requests.post(
                                'https://functions.poehali.dev/56814ab9-6cba-4035-a63d-423ac0d301c8',
                                json={
                                    'image_url': photo,
                                    'folder': 'lookbooks',
                                    'user_id': str(user_id)
                                },
                                timeout=30
                            )
                            print(f'S3 save response (PUT): {save_response.status_code}, body: {save_response.text}')
                            if save_response.status_code == 200:
                                save_data = save_response.json()
                                new_url = save_data.get('url', photo)
                                print(f'Got new URL (PUT): {new_url}')
                                saved_photos.append(new_url)
                            else:
                                print(f'S3 save failed (PUT) with status {save_response.status_code}')
                                saved_photos.append(photo)
                        except Exception as e:
                            print(f'S3 save exception (PUT): {str(e)}')
                            saved_photos.append(photo)
                    else:
                        saved_photos.append(photo)
            
            # Delete removed photos from S3
            if old_photos and saved_photos:
                deleted_photos = set(old_photos) - set(saved_photos)
                s3_enabled = os.environ.get('S3_ACCESS_KEY')
                for deleted_photo in deleted_photos:
                    if s3_enabled:
                        try:
                            requests.post(
                                'https://functions.poehali.dev/caf33ea6-1aaa-46b4-bc76-9b03bee18925',
                                json={'image_url': deleted_photo},
                                timeout=10
                            )
                            print(f'Deleted from S3: {deleted_photo}')
                        except Exception as e:
                            print(f'S3 delete failed: {str(e)}')
            
            cursor.execute(
                """
                UPDATE lookbooks 
                SET name = COALESCE(%s, name),
                    person_name = COALESCE(%s, person_name),
                    photos = COALESCE(%s, photos),
                    color_palette = COALESCE(%s, color_palette),
                    is_public = COALESCE(%s, is_public),
                    share_token = COALESCE(%s, share_token),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND user_id = %s
                RETURNING id, name, person_name, photos, color_palette, created_at, updated_at
                """,
                (name, person_name, saved_photos, color_palette, is_public, share_token, lookbook_id, user_id)
            )
            
            lookbook = cursor.fetchone()
            
            if not lookbook:
                conn.rollback()
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Lookbook not found'})
                }
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'id': str(lookbook['id']),
                    'name': lookbook['name'],
                    'person_name': lookbook['person_name'],
                    'photos': lookbook['photos'] or [],
                    'color_palette': lookbook['color_palette'] or [],
                    'created_at': lookbook['created_at'].isoformat(),
                    'updated_at': lookbook['updated_at'].isoformat()
                })
            }
        
        elif method == 'DELETE':
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
            
            query_params = event.get('queryStringParameters') or {}
            lookbook_id = query_params.get('id')
            
            if not lookbook_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing id'})
                }
            
            # Get photos before deletion to delete from FTP
            cursor.execute(
                "SELECT photos FROM lookbooks WHERE id = %s AND user_id = %s",
                (lookbook_id, user_id)
            )
            lookbook_to_delete = cursor.fetchone()
            photos_to_delete = lookbook_to_delete['photos'] if lookbook_to_delete else []
            
            cursor.execute(
                "DELETE FROM lookbooks WHERE id = %s AND user_id = %s RETURNING id",
                (lookbook_id, user_id)
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
                    'body': json.dumps({'error': 'Lookbook not found'})
                }
            
            conn.commit()
            
            # Delete photos from S3 after successful DB deletion
            s3_enabled = os.environ.get('S3_ACCESS_KEY')
            if photos_to_delete and s3_enabled:
                for photo in photos_to_delete:
                    try:
                        requests.post(
                            'https://functions.poehali.dev/caf33ea6-1aaa-46b4-bc76-9b03bee18925',
                            json={'image_url': photo},
                            timeout=10
                        )
                        print(f'Deleted from S3 on lookbook delete: {photo}')
                    except Exception as e:
                        print(f'S3 delete failed on lookbook delete: {str(e)}')
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'message': 'Lookbook deleted successfully'})
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