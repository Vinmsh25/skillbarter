import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

print(f"Deleting ALL {User.objects.count()} users...")
User.objects.all().delete()
print(f"Done! Users remaining: {User.objects.count()}")
