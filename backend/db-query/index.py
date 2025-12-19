import json
import os
import psycopg2
from typing import Dict, Any, List, Optional

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Универсальный API для работы с базой данных
    Args: event - dict with httpMethod, body
          context - object with request_id attribute
    Returns: HTTP response with query results
    '''
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    try:
        body = json.loads(event.get('body', '{}'))
        table = body.get('table')
        action = body.get('action')
        
        # Log basic request info (without sensitive data)
        print(f'[DB-Query] table={table}, action={action}')
        
        if not table or not action:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'error': 'Missing table or action'}),
                'isBase64Encoded': False
            }
        
        # Whitelist allowed tables
        allowed_tables = [
            'nanobananapro_tasks',
            'try_on_history',
            'lookbooks',
            'clothing_catalog',
            'users'
        ]
        
        if table not in allowed_tables:
            return {
                'statusCode': 403,
                'headers': {
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'error': f'Access to table {table} is not allowed'}),
                'isBase64Encoded': False
            }
        
        # Connect to database
        dsn = os.environ.get('DATABASE_URL')
        if not dsn:
            raise Exception('DATABASE_URL not configured')
        
        conn = psycopg2.connect(dsn)
        cursor = conn.cursor()
        
        schema = 't_p29007832_virtual_fitting_room'
        full_table = f'{schema}.{table}'
        
        result_data = None
        
        if action == 'select':
            # SELECT query
            where = body.get('where', {})
            limit = body.get('limit', 100)
            order_by = body.get('order_by', 'created_at DESC')
            
            query = f'SELECT * FROM {full_table}'
            params = []
            
            if where:
                where_parts = []
                for key, value in where.items():
                    where_parts.append(f'{key} = %s')
                    params.append(value)
                query += ' WHERE ' + ' AND '.join(where_parts)
            
            query += f' ORDER BY {order_by} LIMIT %s'
            params.append(limit)
            
            cursor.execute(query, params)
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            
            result_data = [dict(zip(columns, row)) for row in rows]
        
        elif action == 'insert':
            # INSERT query
            data = body.get('data', {})
            if not data:
                raise Exception('No data provided for insert')
            
            columns = list(data.keys())
            values = list(data.values())
            placeholders = ', '.join(['%s'] * len(values))
            columns_str = ', '.join(columns)
            
            query = f'INSERT INTO {full_table} ({columns_str}) VALUES ({placeholders}) RETURNING *'
            cursor.execute(query, values)
            
            columns = [desc[0] for desc in cursor.description]
            row = cursor.fetchone()
            result_data = dict(zip(columns, row)) if row else None
            
            conn.commit()
        
        elif action == 'update':
            # UPDATE query
            where = body.get('where', {})
            data = body.get('data', {})
            
            if not where or not data:
                raise Exception('Missing where or data for update')
            
            set_parts = []
            params = []
            for key, value in data.items():
                set_parts.append(f'{key} = %s')
                params.append(value)
            
            where_parts = []
            for key, value in where.items():
                where_parts.append(f'{key} = %s')
                params.append(value)
            
            query = f'UPDATE {full_table} SET {", ".join(set_parts)} WHERE {" AND ".join(where_parts)} RETURNING *'
            cursor.execute(query, params)
            
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            result_data = [dict(zip(columns, row)) for row in rows]
            
            conn.commit()
        
        elif action == 'delete':
            # DELETE query
            where = body.get('where', {})
            if not where:
                raise Exception('Missing where for delete')
            
            where_parts = []
            params = []
            for key, value in where.items():
                where_parts.append(f'{key} = %s')
                params.append(value)
            
            query = f'DELETE FROM {full_table} WHERE {" AND ".join(where_parts)} RETURNING *'
            cursor.execute(query, params)
            
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            result_data = [dict(zip(columns, row)) for row in rows]
            
            conn.commit()
        
        else:
            raise Exception(f'Unknown action: {action}')
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True,
                'data': result_data
            }, default=str),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        print(f'[db-query] Error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }