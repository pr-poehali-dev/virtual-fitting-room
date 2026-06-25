'''Сборка промптов для генераций freegen.

Содержит переиспользуемые функции построения промптов под разные типы задач.
Файл дублируется в freegen-async-start и freegen-async-worker, т.к. функции изолированы.
'''
from typing import Dict, Any


GENDER_MAP = {
    'female': 'a woman',
    'male': 'a man',
}

BODY_TYPE_MAP = {
    'slim': 'slim slender body',
    'athletic': 'athletic toned body',
    'average': 'average body type',
    'curvy': 'curvy body',
    'plus': 'plus-size full figured body',
}

HAIR_LENGTH_MAP = {
    'short': 'short hair',
    'medium': 'medium length hair',
    'long': 'long hair',
}


def _clean(value: Any) -> str:
    if value is None:
        return ''
    return str(value).strip()


def build_model_prompt(params: Dict[str, Any]) -> str:
    '''Собрать английский промпт для генерации модели в полный рост 2:3.

    Обязательные: gender, age, height, body_type.
    Опциональные: hair_color, eye_color, hair_length, colortype, kibbe.
    Модель всегда в базовой одежде: майка + короткие шорты до середины бедра.
    '''
    gender = _clean(params.get('gender'))
    person = GENDER_MAP.get(gender, 'a person')

    parts = [f'Full-body studio fashion photo of {person}']

    age = _clean(params.get('age'))
    if age:
        parts.append(f'approximately {age} years old')

    height = _clean(params.get('height'))
    if height:
        parts.append(f'height around {height} cm')

    body_type = _clean(params.get('body_type'))
    if body_type:
        parts.append(BODY_TYPE_MAP.get(body_type, body_type))

    hair_length = _clean(params.get('hair_length'))
    hair_color = _clean(params.get('hair_color'))
    if hair_color or hair_length:
        hair_desc = ' '.join(filter(None, [
            hair_color,
            HAIR_LENGTH_MAP.get(hair_length, hair_length),
        ])).strip()
        if hair_desc:
            parts.append(f'{hair_desc}')

    eye_color = _clean(params.get('eye_color'))
    if eye_color:
        parts.append(f'{eye_color} eyes')

    colortype = _clean(params.get('colortype'))
    if colortype:
        parts.append(f'{colortype} color type appearance')

    kibbe = _clean(params.get('kibbe'))
    if kibbe:
        parts.append(f'{kibbe} Kibbe body type')

    description = ', '.join(parts)

    suffix = (
        '. Wearing a plain fitted tank top and short shorts reaching mid-thigh. '
        'Standing straight, full height from head to toe visible, front view, '
        'neutral pose with arms relaxed at sides. '
        'Clean light gray studio background, soft even lighting, '
        'photorealistic, high detail, sharp focus.'
    )

    return description + suffix
