from companies.models import Company
from companies.serializers import CompanySerializer


@api_view(["GET", "PUT"])
def profile(request):
    if request.method == "GET":
        user_id = request.query_params.get("userId")
        if not user_id:
            return Response({"message": "userId обязателен"}, status=400)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"message": "Пользователь не найден"}, status=404)

        company_data = None
        if user.company_id:
            company = Company.objects.filter(id=user.company_id).first()
            if company:
                company_data = CompanySerializer(company).data

        return Response({
            "user": UserSerializer(user).data,
            "company": company_data,
        })

    # PUT
    user_id = request.data.get("id")
    if not user_id:
        return Response({"message": "ID пользователя не указан"}, status=400)

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"message": "Пользователь не найден"}, status=404)

    full_name = request.data.get("full_name")
    phone = request.data.get("phone")
    email = request.data.get("email")

    if full_name is not None:
        user.full_name = full_name
    if phone is not None:
        user.phone = phone
    if email is not None:
        user.email = email
    user.save()

    company_payload = request.data.get("company")
    if user.company_id and company_payload:
        company = Company.objects.filter(id=user.company_id).first()
        if company:
            name = company_payload.get("name")
            address = company_payload.get("address")
            phone = company_payload.get("phone")
            email = company_payload.get("email")

            if name and name.strip():
                company.name = name
            if address and address.strip():
                company.address = address
            if phone is not None:
                company.phone = phone
            if email is not None:
                company.email = email
            company.save()

    company_data = None
    if user.company_id:
        company = Company.objects.filter(id=user.company_id).first()
        if company:
            company_data = CompanySerializer(company).data

    return Response({
        "user": UserSerializer(user).data,
        "company": company_data,
    })