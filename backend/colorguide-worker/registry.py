"""Реестр картиночных сервисов стилевого анализа.

Каждый сервис описывает:
- gemini_prompt: промпт для анализа фото
- response_schema: строгая JSON-схема ответа Gemini
- required_fields: обязательные поля для проверки полноты
- build_image_prompt(data, height): сборка промпта для nano-banana-2
- template_image_url: картинка-образец лайаута (референс)
- aspect_ratio: соотношение сторон итоговой картинки

Цветотип 'colorguide' здесь НЕ регистрируется — он обрабатывается
старой логикой в index.py без изменений.
"""

from services import style
from services import outfit
from services import glasses
from services import makeup
from services import hairstyle
from services import kibbe
from services import gift
from services import perfume
from services import wedding

# service_type -> модуль сервиса
IMAGE_SERVICES = {
    'style': style,
    'outfit': outfit,
    'glasses': glasses,
    'makeup': makeup,
    'hairstyle': hairstyle,
    'kibbe': kibbe,
    'gift': gift,
    'perfume': perfume,
    'wedding': wedding,
}


def is_image_service(service_type: str) -> bool:
    return service_type in IMAGE_SERVICES


def is_text_only(service_type: str) -> bool:
    """Сервис работает без фото и не рисует картинку."""
    service = IMAGE_SERVICES.get(service_type)
    return bool(getattr(service, 'TEXT_ONLY', False))


def get_service(service_type: str):
    return IMAGE_SERVICES.get(service_type)