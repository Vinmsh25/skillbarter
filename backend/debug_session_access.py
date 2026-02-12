
import os
import django
import sys

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')
django.setup()

from core.models import Session, User

def check_session(session_id):
    print(f"Checking Session {session_id}...")
    try:
        session = Session.objects.get(pk=session_id)
        print(f"Session {session_id} Found:")
        print(f"  - User1: {session.user1.id} ({session.user1.email})")
        print(f"  - User2: {session.user2.id} ({session.user2.email})")
        print(f"  - Is Active: {session.is_active}")
        
        print("\nAll Users:")
        for user in User.objects.all():
            print(f"  - ID: {user.id}, Email: {user.email}, Name: {user.name}")
            
    except Session.DoesNotExist:
        print(f"Session {session_id} DOES NOT EXIST.")

if __name__ == "__main__":
    check_session(1)
