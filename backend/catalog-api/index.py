import json
import os
from typing import Dict, Any, List
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Manage clothing catalog with categories, colors, archetypes
    Args: event - dict with httpMethod, body, queryStringParameters
          context - object with attributes: request_id, function_name
    Returns: HTTP response with catalog items or operation result
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Admin-Password',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        query_params = event.get('queryStringParameters') or {}
        action = query_params.get('action', 'list')
        
        # GET /catalog-api?action=list&categories=1,2&colors=3&archetypes=4
        if method == 'GET':
            if action == 'list':
                # First, get all clothing items
                base_query = """
                    SELECT id, image_url, name, description, created_at
                    FROM clothing_catalog
                    WHERE 1=1
                """
                
                conditions = []
                
                # Filter by categories
                category_ids = query_params.get('categories', '').split(',') if query_params.get('categories') else []
                if category_ids and category_ids[0]:
                    category_ids_str = ','.join([str(int(cid)) for cid in category_ids if cid.strip()])
                    if category_ids_str:
                        conditions.append(f"""
                            EXISTS (
                                SELECT 1 FROM clothing_category_links ccl
                                WHERE ccl.clothing_id = clothing_catalog.id AND ccl.category_id IN ({category_ids_str})
                            )
                        """)
                
                # Filter by colors
                color_ids = query_params.get('colors', '').split(',') if query_params.get('colors') else []
                if color_ids and color_ids[0]:
                    color_ids_str = ','.join([str(int(cid)) for cid in color_ids if cid.strip()])
                    if color_ids_str:
                        conditions.append(f"""
                            EXISTS (
                                SELECT 1 FROM clothing_color_links cl
                                WHERE cl.clothing_id = clothing_catalog.id AND cl.color_group_id IN ({color_ids_str})
                            )
                        """)
                
                # Filter by archetypes
                archetype_ids = query_params.get('archetypes', '').split(',') if query_params.get('archetypes') else []
                if archetype_ids and archetype_ids[0]:
                    archetype_ids_str = ','.join([str(int(aid)) for aid in archetype_ids if aid.strip()])
                    if archetype_ids_str:
                        conditions.append(f"""
                            EXISTS (
                                SELECT 1 FROM clothing_archetype_links cal
                                WHERE cal.clothing_id = clothing_catalog.id AND cal.archetype_id IN ({archetype_ids_str})
                            )
                        """)
                
                if conditions:
                    base_query += ' AND ' + ' AND '.join(conditions)
                
                base_query += ' ORDER BY created_at DESC'
                
                cursor.execute(base_query)
                items = cursor.fetchall()
                
                # Enrich each item with categories, colors, and archetypes
                result = []
                for item in items:
                    item_dict = dict(item)
                    item_id = item_dict['id']
                    
                    # Get categories
                    cursor.execute("""
                        SELECT cat.name
                        FROM clothing_category_links ccl
                        JOIN clothing_categories cat ON cat.id = ccl.category_id
                        WHERE ccl.clothing_id = %s
                    """, (item_id,))
                    item_dict['categories'] = [row['name'] for row in cursor.fetchall()]
                    
                    # Get colors
                    cursor.execute("""
                        SELECT cg.name
                        FROM clothing_color_links cl
                        JOIN color_groups cg ON cg.id = cl.color_group_id
                        WHERE cl.clothing_id = %s
                    """, (item_id,))
                    item_dict['colors'] = [row['name'] for row in cursor.fetchall()]
                    
                    # Get archetypes
                    cursor.execute("""
                        SELECT ka.name
                        FROM clothing_archetype_links cal
                        JOIN kibbe_archetypes ka ON ka.id = cal.archetype_id
                        WHERE cal.clothing_id = %s
                    """, (item_id,))
                    item_dict['archetypes'] = [row['name'] for row in cursor.fetchall()]
                    
                    result.append(item_dict)
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps(result, default=str)
                }
            
            elif action == 'filters':
                # Get all available filters
                cursor.execute('SELECT id, name FROM clothing_categories ORDER BY name')
                categories = cursor.fetchall()
                
                cursor.execute('SELECT id, name FROM color_groups ORDER BY name')
                colors = cursor.fetchall()
                
                cursor.execute('SELECT id, name FROM kibbe_archetypes ORDER BY name')
                archetypes = cursor.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'categories': [dict(c) for c in categories],
                        'colors': [dict(c) for c in colors],
                        'archetypes': [dict(a) for a in archetypes]
                    })
                }
        
        # POST /catalog-api - Add new clothing item (admin only)
        elif method == 'POST':
            admin_password = event.get('headers', {}).get('x-admin-password') or event.get('headers', {}).get('X-Admin-Password')
            expected_password = os.environ.get('ADMIN_PASSWORD')
            
            if not admin_password or admin_password != expected_password:
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Forbidden'})
                }
            
            body_data = json.loads(event.get('body', '{}'))
            image_url = body_data.get('image_url')
            name = body_data.get('name', '')
            description = body_data.get('description', '')
            category_ids = body_data.get('category_ids', [])
            color_ids = body_data.get('color_ids', [])
            archetype_ids = body_data.get('archetype_ids', [])
            
            if not image_url:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing image_url'})
                }
            
            # Insert clothing item
            cursor.execute("""
                INSERT INTO clothing_catalog (image_url, name, description)
                VALUES (%s, %s, %s)
                RETURNING id
            """, (image_url, name, description))
            
            clothing_id = cursor.fetchone()['id']
            
            # Add category links
            for cat_id in category_ids:
                cursor.execute("""
                    INSERT INTO clothing_category_links (clothing_id, category_id)
                    VALUES (%s, %s)
                """, (clothing_id, cat_id))
            
            # Add color links
            for color_id in color_ids:
                cursor.execute("""
                    INSERT INTO clothing_color_links (clothing_id, color_group_id)
                    VALUES (%s, %s)
                """, (clothing_id, color_id))
            
            # Add archetype links
            for arch_id in archetype_ids:
                cursor.execute("""
                    INSERT INTO clothing_archetype_links (clothing_id, archetype_id)
                    VALUES (%s, %s)
                """, (clothing_id, arch_id))
            
            return {
                'statusCode': 201,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'id': str(clothing_id), 'message': 'Clothing item added'})
            }
        
        # DELETE /catalog-api?id=uuid (admin only)
        elif method == 'DELETE':
            admin_password = event.get('headers', {}).get('x-admin-password') or event.get('headers', {}).get('X-Admin-Password')
            expected_password = os.environ.get('ADMIN_PASSWORD')
            
            if not admin_password or admin_password != expected_password:
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Forbidden'})
                }
            
            clothing_id = query_params.get('id')
            if not clothing_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing id parameter'})
                }
            
            # Delete links first
            cursor.execute('DELETE FROM clothing_category_links WHERE clothing_id = %s', (clothing_id,))
            cursor.execute('DELETE FROM clothing_color_links WHERE clothing_id = %s', (clothing_id,))
            cursor.execute('DELETE FROM clothing_archetype_links WHERE clothing_id = %s', (clothing_id,))
            
            # Delete clothing item
            cursor.execute('DELETE FROM clothing_catalog WHERE id = %s', (clothing_id,))
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'message': 'Clothing item deleted'})
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