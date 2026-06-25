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


def _basket_num(vol: int) -> int:
    '''Возвращает номер basket-хоста WB по диапазону vol.'''
    if vol <= 143:
        return 1
    elif vol <= 287:
        return 2
    elif vol <= 431:
        return 3
    elif vol <= 719:
        return 4
    elif vol <= 1007:
        return 5
    elif vol <= 1061:
        return 6
    elif vol <= 1115:
        return 7
    elif vol <= 1169:
        return 8
    elif vol <= 1313:
        return 9
    elif vol <= 1601:
        return 10
    elif vol <= 1655:
        return 11
    elif vol <= 1919:
        return 12
    elif vol <= 2045:
        return 13
    elif vol <= 2189:
        return 14
    elif vol <= 2405:
        return 15
    elif vol <= 2621:
        return 16
    elif vol <= 2837:
        return 17
    elif vol <= 3053:
        return 18
    elif vol <= 3269:
        return 19
    elif vol <= 3485:
        return 20
    elif vol <= 3701:
        return 21
    elif vol <= 3917:
        return 22
    elif vol <= 4133:
        return 23
    elif vol <= 4349:
        return 24
    elif vol <= 4565:
        return 25
    else:
        return 26


def _basket_host(vol: int) -> str:
    return f'basket-{_basket_num(vol):02d}.wbbasket.ru'


def _candidate_hosts(vol: int) -> list:
    '''Список host-кандидатов: основной + соседние (WB меняет диапазоны).'''
    base = _basket_num(vol)
    nums = [base]
    # Перебираем вверх и вниз вокруг расчётного значения
    for delta in range(1, 8):
        nums.append(base + delta)
        if base - delta >= 1:
            nums.append(base - delta)
    seen = []
    for n in nums:
        if 1 <= n <= 40 and n not in seen:
            seen.append(n)
    return [f'basket-{n:02d}.wbbasket.ru' for n in seen]


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


def fetch_name(nm_id: int, hosts: list, vol: int, part: int) -> str:
    '''Название товара из card.json (если доступно) или из card.wb.ru.'''
    for host in hosts:
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


def fetch_image_data_url(nm_id: int, hosts: list, vol: int, part: int) -> Optional[str]:
    '''Скачивает первое фото товара и возвращает base64 data-URL (у нас не храним).

    Перебирает host-кандидаты, т.к. WB периодически меняет распределение по basket-хостам.
    '''
    for host in hosts:
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
    hosts = _candidate_hosts(vol)
    product_url = f'https://www.wildberries.ru/catalog/{nm_id}/detail.aspx'

    image = fetch_image_data_url(nm_id, hosts, vol, part)
    name = fetch_name(nm_id, hosts, vol, part)

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