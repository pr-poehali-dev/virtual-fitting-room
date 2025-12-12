import json
import os
from typing import Dict, Any, Optional, List
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.config import Config
from pydantic import BaseModel, Field, field_validator

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
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': 'https://fitting-room.ru',
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        headers = event.get('headers', {})
        user_id = headers.get('x-user-id') or headers.get('X-User-Id')
        
        if not user_id:
            return {
                'statusCode': 401,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Unauthorized - User ID required'})
            }
        
        if method == 'GET':
            print(f'[HistoryAPI] GET request for user {user_id}')
            cursor.execute(
                "SELECT id, result_image, created_at, model_used, saved_to_lookbook, cost FROM try_on_history WHERE user_id = %s ORDER BY created_at DESC LIMIT 300",
                (user_id,)
            )
            history = cursor.fetchall()
            print(f'[HistoryAPI] Found {len(history)} records')
            
            result_items = []
            for h in history:
                try:
                    item = {
                        'id': str(h['id']),
                        'result_image': h['result_image'],
                        'created_at': h['created_at'].isoformat(),
                        'model_used': h.get('model_used'),
                        'saved_to_lookbook': h.get('saved_to_lookbook', False),
                        'cost': float(h.get('cost', 0))
                    }
                    result_items.append(item)
                except Exception as item_error:
                    print(f'[HistoryAPI] Error processing item {h.get("id")}: {item_error}')
            
            print(f'[HistoryAPI] Successfully processed {len(result_items)} items')
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps(result_items)
            }
        
        elif method == 'POST':
            body_str = event.get('body', '{}')
            body_data = json.loads(body_str)
            
            class TryOnHistoryCreate(BaseModel):
                person_image: str = Field(..., min_length=1)
                result_image: str = Field(..., min_length=1)
                garments: Optional[List[Dict[str, Any]]] = None
                garment_image: Optional[str] = None
                model_used: str = Field(default='unknown')
                cost: float = Field(default=0, ge=0)
                
                @field_validator('person_image', 'result_image')
                def validate_image_url(cls, v):
                    if not v.startswith(('http://', 'https://', 'data:')):
                        raise ValueError('Must be a valid URL or data URI')
                    return v
            
            try:
                validated = TryOnHistoryCreate(**body_data)
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': f'Validation error: {str(e)}'})
                }
            
            person_image = validated.person_image
            garments = validated.garments
            result_image = validated.result_image
            model_used = validated.model_used
            cost = validated.cost
            
            # Debug logging - log every POST request
            try:
                result_preview = result_image[:60] if result_image else ''
                
                cursor.execute(
                    """INSERT INTO history_api_debug_log (user_id, model_used, result_image_preview, raw_body) 
                    VALUES (%s, %s, %s, %s)""",
                    (user_id, model_used, result_preview, body_str[:500])
                )
                conn.commit()
            except Exception as log_error:
                pass  # Don't fail if logging fails
            
            if not person_image or not result_image:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing required fields'})
                }
            
            if garments and isinstance(garments, list):
                garments_json = json.dumps(garments)
                garment_image = garments[0]['image'] if len(garments) > 0 else ''
            else:
                garment_image = body_data.get('garment_image', '')
                garments_json = json.dumps([{'image': garment_image}])
            
            cursor.execute(
                """
                INSERT INTO try_on_history (person_image, garment_image, result_image, user_id, garments, model_used, cost, saved_to_lookbook)
                VALUES (%s, %s, %s, %s, %s, %s, %s, false)
                RETURNING id, person_image, garment_image, result_image, created_at, model_used, cost, saved_to_lookbook
                """,
                (person_image, garment_image, result_image, user_id, garments_json, model_used, cost)
            )
            
            history_item = cursor.fetchone()
            conn.commit()
            
            return {
                'statusCode': 201,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
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
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing id'})
                }
            
            # Get result_image before deletion to check if it should be deleted from storage
            cursor.execute(
                "SELECT result_image FROM try_on_history WHERE id = %s AND user_id = %s",
                (history_id, user_id)
            )
            history_item = cursor.fetchone()
            
            if not history_item:
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'History item not found'})
                }
            
            result_image_url = history_item['result_image']
            
            # Check if this photo exists in any lookbook
            cursor.execute(
                "SELECT COUNT(*) as count FROM lookbooks WHERE user_id = %s AND %s = ANY(photos)",
                (user_id, result_image_url)
            )
            lookbook_count = cursor.fetchone()['count']
            
            # Delete from history
            cursor.execute(
                "DELETE FROM try_on_history WHERE id = %s AND user_id = %s RETURNING id",
                (history_id, user_id)
            )
            
            deleted = cursor.fetchone()
            
            if not deleted:
                conn.rollback()
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'History item not found'})
                }
            
            conn.commit()
            
            # No S3 deletion - images from Replicate/FAL are kept on their servers
            # Only images saved to lookbooks will be in S3
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'message': 'History item deleted successfully'})
            }
        
        else:
            return {
                'statusCode': 405,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Method not allowed'})
            }
    
    except Exception as e:
        print(f'[HistoryAPI] Error: {type(e).__name__}: {str(e)}')
        try:
            if 'conn' in locals():
                conn.rollback()
        except:
            pass
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://fitting-room.ru'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        try:
            if 'cursor' in locals():
                cursor.close()
            if 'conn' in locals():
                conn.close()
        except:
            pass