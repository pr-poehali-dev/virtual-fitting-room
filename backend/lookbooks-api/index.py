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
            
            # Save photos to hosting via FTP
            saved_photos = []
            ftp_enabled = os.environ.get('FTP_HOST')
            for photo in photos:
                if photo.startswith(('http://', 'https://', 'data:')) and ftp_enabled:
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
                        if save_response.status_code == 200:
                            save_data = save_response.json()
                            saved_photos.append(save_data.get('url', photo))
                        else:
                            saved_photos.append(photo)
                    except:
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
            
            # Save new photos to hosting via FTP
            saved_photos = photos
            if photos:
                saved_photos = []
                ftp_enabled = os.environ.get('FTP_HOST')
                for photo in photos:
                    if photo.startswith(('http://', 'https://', 'data:')) and ftp_enabled:
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
                            if save_response.status_code == 200:
                                save_data = save_response.json()
                                saved_photos.append(save_data.get('url', photo))
                            else:
                                saved_photos.append(photo)
                        except:
                            saved_photos.append(photo)
                    else:
                        saved_photos.append(photo)
            
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