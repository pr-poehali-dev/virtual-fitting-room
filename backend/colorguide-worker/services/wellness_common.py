"""Общие части сервисов 'Спорт и фитнес', 'SPA-уход', 'План питания'.

Все три работают одинаково:
- фото необязательно (PHOTOS_OPTIONAL), картинка не рисуется (NO_IMAGE_GEN);
- анкета 'О себе' общая, у каждого сервиса — свой блок вопросов;
- план можно заказывать каждую неделю: учитываем номер недели и отзыв о прошлой.
"""

from services.outfit import QWEN_MODEL

USE_QWEN = True
GEMINI_MODEL = QWEN_MODEL
TEXT_ONLY = False
NO_IMAGE_GEN = True
PHOTOS_OPTIONAL = True
PARAMS_FIRST = True
TEMPERATURE = 0.7

PERSON_FIELDS = [
    ('Имя (обращайся по имени)', 'client_name'),
    ('Пол', 'gender'),
    ('Возраст', 'age'),
    ('Рост (см)', 'height'),
    ('Вес (кг)', 'weight'),
    ('Группа крови', 'blood_type'),
    ('Город / регион проживания', 'city'),
    ('Климат проживания', 'climate'),
    ('Текущий сезон', 'season'),
    ('Ограничения по здоровью', 'health'),
    ('Типаж по Дэвиду Кибби', 'kibbe'),
    ('Архетип(ы) по Карлу Юнгу', 'archetypes'),
    ('Комментарий клиента', 'comment'),
]

WEEK_FIELDS = [
    ('Какая это неделя по счёту', 'week_number'),
    ('Как прошла прошлая неделя (отзыв клиента)', 'last_week_feedback'),
]

COMMON_RULES = '''ОБЩИЕ ПРАВИЛА:
- ЗДОРОВЬЕ ПРЕЖДЕ ВСЕГО: ты не врач и не ставишь диагнозов. Если указаны ограничения по здоровью — выбирай только щадящие и безопасные варианты, всё рискованное исключай и прямо советуй согласовать план с врачом.
- ГРУППА КРОВИ: учитывай её мягко, как пожелание клиента. Научных доказательств у подходов «по группе крови» нет — не строй на ней основу плана и не пугай запретами.
- ТИПАЖ И АРХЕТИП: используй для персонализации — характер, темп, стиль, эстетика и то, что будет приносить человеку удовольствие и мотивировать.
- КЛИМАТ, РЕГИОН И СЕЗОН: всё должно быть реально выполнимо там, где человек живёт, в текущий сезон.
- ЕЖЕНЕДЕЛЬНОСТЬ: если указан номер недели и отзыв о прошлой неделе — учти их: что не понравилось — замени, что получилось — развивай, нагрузку/сложность меняй постепенно.
- Если приложено фото — опирайся на то, что реально видно, но не выдумывай. Если фото нет — работай только по анкете.
- ПИШИ КРАТКО и конкретно, без воды и повторов, но не упуская сути. Обращайся к клиенту по имени, если оно указано.
- Верни СТРОГО валидный JSON (без markdown-обёртки ```), на русском языке.'''


def make_params_block(form_params: dict, service_fields: list, header: str) -> str:
    """Собирает блок анкеты из заполненных полей: специфичные + общие + неделя."""
    if not form_params or not isinstance(form_params, dict):
        return ''

    def collect(pairs):
        out = []
        for label, key in pairs:
            value = form_params.get(key)
            if value is None:
                continue
            if isinstance(value, (list, tuple)):
                vals = [str(v).strip() for v in value if str(v or '').strip()]
                if vals:
                    out.append(f'- {label}: {", ".join(vals)}')
            else:
                s = str(value).strip()
                if s:
                    out.append(f'- {label}: {s}')
        return out

    parts = ['ЭТО ГЛАВНОЕ В ЗАДАЧЕ — АНКЕТА КЛИЕНТА. Она важнее общих правил. '
             'Не указанные параметры — не выдумывай.']
    special = collect(service_fields)
    person = collect(PERSON_FIELDS)
    week = collect(WEEK_FIELDS)
    if special:
        parts.append(f'{header}:\n' + '\n'.join(special))
    if person:
        parts.append('О КЛИЕНТЕ:\n' + '\n'.join(person))
    if week:
        parts.append('НЕДЕЛЯ:\n' + '\n'.join(week))
    return '\n\n'.join(parts)


def build_photo_block(has_person: bool, ref_count: int) -> str:
    if has_person:
        return ('ПРИЛОЖЕНО ФОТО КЛИЕНТА — используй его только для уточнения '
                '(фигура, кожа, волосы — то, что реально видно).')
    return 'ФОТО НЕ ПРИЛОЖЕНО — работай только по анкете, не делай вид, что видишь человека.'


def build_image_prompt(data: dict, height: int = None) -> str:
    return ''
