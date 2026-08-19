from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Laboratory
from .serializers import LabSerializer


@api_view(["GET"])
def get_all_labs(request):
    labs = Laboratory.objects.all()
    serializer = LabSerializer(labs, many=True)
    return Response(serializer.data)