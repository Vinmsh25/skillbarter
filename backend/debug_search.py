import os
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')
django.setup()

from django.contrib.auth import get_user_model
from core.serializers import UserPublicSerializer
from django.db.models import Q
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

User = get_user_model()
print(f"Total users: {User.objects.count()}")

# Test Query
query = "qwer"
users = User.objects.filter(
    Q(name__icontains=query) | Q(email__icontains=query)
)[:20]
print(f"Users found for '{query}': {list(users)}")

# Check DEBUG setting
print(f"DEBUG setting: {settings.DEBUG}")

# Test User Save
try:
    if users.exists():
        u = users.first()
        print(f"Testing save on user {u} ({type(u)})...")
        u.save(update_fields=[])
        print("User.save with update_fields passed.")
    else:
        print("No user to test save.")
except Exception as e:
    print(f"User.save FAILED: {e}")

# Test Serializer
if users.exists():
    try:
        print("Testing serializer...")
        serializer = UserPublicSerializer(users, many=True)
        print("Serialized data:", serializer.data)
        print("Serializer test passed.")
    except Exception as e:
        print("Serializer failed!")
        import traceback
        traceback.print_exc()
else:
    print("No users found to test serializer.")
