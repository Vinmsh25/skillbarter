
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

print("Checking for orphaned posts...")

all_users_ids = set(User.objects.values_list('id', flat=True))
print(f"Valid User IDs: {all_users_ids}")

orphaned_posts = []
for post in LearningRequestPost.objects.all():
    if post.creator_id not in all_users_ids:
        orphaned_posts.append(post)

if orphaned_posts:
    print(f"Found {len(orphaned_posts)} orphaned posts.")
    for post in orphaned_posts:
        print(f"Deleting post ID: {post.id}, Creator ID: {post.creator_id} (Missing)")
        post.delete()
    print("Cleanup complete.")
else:
    print("No orphaned posts found.")
