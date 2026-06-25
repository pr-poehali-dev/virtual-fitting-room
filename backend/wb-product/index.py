import json
import re
import base64
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, Tuple


def _cors_headers() -> Dict[str, str]:
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
        'Access-Control-Max-Age': '86400',
    }


def extract_nm_id(raw: str) -> Optional[int]:
    '''Достаёт артикул (nmId) из ссылки Wildberries или из чистого числа.'''
    raw = (raw or '').strip()
    if not raw:
        return None
    if raw.isdigit():
        return int(raw)
    # .../catalog/123456789/detail.aspx  или  ?card=123456789  или  nm=123456789
    patterns = [
        r'/catalog/(\d+)',
        r'[?&]nm=(\d+)',
        r'[?&]card=(\d+)',
        r'(\d{6,})',
    ]
    for pat in patterns:
        m = re.search(pat, raw)
        if m:
            return int(m.group(1))
    return None


def _basket_host(vol: int) -> str:
    '''Возвращает номер basket-хоста WB по диапазону vol.'''
    if vol <= 143:
        n = '01'
    elif vol <= 287:
        n = '02'
    elif vol <= 431:
        n = '03'
    elif vol <= 719:
        n = '04'
    elif vol <= 1007:
        n = '05'
    elif vol <= 1061:
        n = '06'
    elif vol <= 1115:
        n = '07'
    elif vol <= 1169:
        n = '08'
    elif vol <= 1313:
        n = '09'
    elif vol <= 1601:
        n = '10'
    elif vol <= 1655:
        n = '11'
    elif vol <= 1919:
        n = '12'
    elif vol <= 2045:
        n = '13'
    elif vol <= 2189:
        n = '14'
    elif vol <= 2405:
        n = '15'
    elif vol <= 2621:
        n = '16'
    elif vol <= 2837:
        n = '17'
    else:
        n = '18'
    return f'basket-{n}.wbbasket.ru'


def _http_get(url: str, timeout: int = 10) -> Optional[bytes]:
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0', 'Accept': '*/*'},
        method='GET',
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except Exception:
        return None


def fetch_name(nm_id: int, host: str, vol: int, part: int) -> str:
    '''Название товара из card.json (если доступно) или из card.wb.ru.'''
    card_url = f'https://{host}/vol{vol}/part{part}/{nm_id}/info/ru/card.json'
    data = _http_get(card_url)
    if data:
        try:
            j = json.loads(data.decode('utf-8'))
            name = (j.get('imt_name') or j.get('subj_name') or '').strip()
            brand = (j.get('selling', {}) or {}).get('brand_name', '')
            if name:
                return (f'{brand} {name}'.strip() if brand else name)
        except Exception:
            pass
    data = _http_get(f'https://card.wb.ru/cards/detail?nm={nm_id}')
    if data:
        try:
            j = json.loads(data.decode('utf-8'))
            products = (j.get('data', {}) or {}).get('products', [])
            if products:
                p = products[0]
                brand = (p.get('brand') or '').strip()
                name = (p.get('name') or '').strip()
                return (f'{brand} {name}'.strip() if brand else name)
        except Exception:
            pass
    return ''


def fetch_image_data_url(nm_id: int, host: str, vol: int, part: int) -> Optional[str]:
    '''Скачивает первое фото товара и возвращает base64 data-URL (у нас не храним).'''
    for ext in ('webp', 'jpg'):
        img_url = f'https://{host}/vol{vol}/part{part}/{nm_id}/images/big/1.{ext}'
        raw = _http_get(img_url, timeout=15)
        if raw and len(raw) > 1000:
            mime = 'image/webp' if ext == 'webp' else 'image/jpeg'
            b64 = base64.b64encode(raw).decode('ascii')
            return f'data:{mime};base64,{b64}'
    return None


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''Business: получить фото и название товара Wildberries по ссылке/артикулу.
    Args: event с httpMethod, body (url или article)
    Returns: {image, name, product_url} — картинку WB не сохраняем, отдаём как data-URL.
    '''
    method = event.get('httpMethod', 'POST')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors_headers(), 'body': ''}

    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': _cors_headers(),
            'body': json.dumps({'error': 'Method not allowed'}),
        }

    try:
        body = json.loads(event.get('body', '{}'))
    except Exception:
        body = {}

    raw = body.get('url') or body.get('article') or ''
    nm_id = extract_nm_id(raw)
    if not nm_id:
        return {
            'statusCode': 400,
            'headers': _cors_headers(),
            'body': json.dumps({'error': 'Не удалось распознать ссылку или артикул Wildberries'}),
        }

    vol = nm_id // 100000
    part = nm_id // 1000
    host = _basket_host(vol)
    product_url = f'https://www.wildberries.ru/catalog/{nm_id}/detail.aspx'

    image = fetch_image_data_url(nm_id, host, vol, part)
    name = fetch_name(nm_id, host, vol, part)

    if not image:
        return {
            'statusCode': 404,
            'headers': _cors_headers(),
            'body': json.dumps({'error': 'Не удалось получить фото товара. Проверьте ссылку.'}),
        }

    return {
        'statusCode': 200,
        'headers': _cors_headers(),
        'body': json.dumps({
            'image': image,
            'name': name or f'Товар WB {nm_id}',
            'product_url': product_url,
            'nm_id': nm_id,
        }),
    }
