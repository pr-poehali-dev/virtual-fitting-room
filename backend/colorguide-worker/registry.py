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

# service_type -> модуль сервиса
IMAGE_SERVICES = {
    'style': style,
}


def is_image_service(service_type: str) -> bool:
    return service_type in IMAGE_SERVICES


def get_service(service_type: str):
    return IMAGE_SERVICES.get(service_type)
