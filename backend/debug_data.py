
import os
import django
import sys

# Add the project directory to the sys.path
sys.path.append(r'c:\Users\sudha\OneDrive\Desktop\skillbarter\backend')

# Set the settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')

# Setup Django
django.setup()

from core.models import User, LearningRequestPost

print("--- USERS ---")
for user in User.objects.all():
    print(f"ID: {user.id}, Name: {user.name}, Email: {user.email}")

print("\n--- POSTS ---")
for post in LearningRequestPost.objects.all():
    print(f"ID: {post.id}, Topic: {post.topic_to_learn}, Creator ID: {post.creator.id}")
