
import os
import django
import sys

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')
django.setup()

from core.models import Session, User

def check_session(session_id):
    print(f"--- Checking Session {session_id} ---")
    try:
        session = Session.objects.get(pk=session_id)
        u1 = session.user1
        u2 = session.user2
        
        print(f"Session ID: {session.id}")
        print(f"User 1: ID={u1.id}, Name={u1.name}, Email={u1.email}")
        print(f"User 2: ID={u2.id}, Name={u2.name}, Email={u2.email}")
        
        print("\n--- All Users ---")
        for user in User.objects.all():
            print(f"User ID: {user.id}, Name={user.name}, Email={user.email}")
            
    except Session.DoesNotExist:
        print(f"Session {session_id} DOES NOT EXIST.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_session(1)
