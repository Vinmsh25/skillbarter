
import os
import django
import sys

# Add the project directory to the sys.path
sys.path.append(r'c:\Users\sudha\OneDrive\Desktop\skillbarter\backend')

# Set the settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')

# Setup Django
django.setup()

from core.models import User, Review, Session

print("--- USERS (Availability & Online Status) ---")
for user in User.objects.all():
    print(f"ID: {user.id}, Name: {user.name}, Online: {user.is_online}, Availability: '{user.availability}'")

print("\n--- REVIEWS ---")
reviews = Review.objects.all()
if not reviews.exists():
    print("No reviews found in database.")
else:
    for review in reviews:
        print(f"Review ID: {review.id}, To: {review.reviewee.name} (ID: {review.reviewee.id}), Rating: {review.rating}, Comment: {review.comment[:30]}...")
