from django.conf import settings
from django.core.exceptions import RequestDataTooBig
from django.http import JsonResponse


def _too_big_response():
    limit_mb = settings.DATA_UPLOAD_MAX_MEMORY_SIZE / 1024 / 1024
    return JsonResponse(
        {"message": f"Запрос слишком большой. Суммарный предел вложений — {limit_mb:.0f} МБ"},
        status=413,
    )


class RequestTooBigJsonMiddleware:
    """Отдаёт JSON 413 вместо HTML-страницы Django, когда тело больше лимита.

    RequestDataTooBig поднимается лениво — при первом обращении к телу, то есть
    уже внутри вьюхи, когда DRF разбирает запрос. Django превращает это в 400 со
    своей HTML-страницей, из которой фронт не достаёт сообщение и показывает
    пустую ошибку.

    Ловим в двух местах: process_exception срабатывает на исключении из вьюхи
    (основной путь), try/except — на случай, если тело тронет кто-то выше по
    цепочке. Место в MIDDLEWARE — ниже CorsMiddleware, иначе на наш ответ не
    навесятся CORS-заголовки и браузер увидит сетевую ошибку вместо 413.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            return self.get_response(request)
        except RequestDataTooBig:
            return _too_big_response()

    def process_exception(self, request, exception):
        if isinstance(exception, RequestDataTooBig):
            return _too_big_response()
        return None
