
import os
import django
import sys

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')
django.setup()

from core.models import Session, User

def check_session(session_id, target_user_id):
    print(f"--- Checking Session {session_id} for User {target_user_id} ---")
    try:
        session = Session.objects.get(pk=session_id)
        u1 = session.user1
        u2 = session.user2
        
        print(f"Session {session.id} Participants:")
        print(f"  User 1: ID={u1.id}, Name='{u1.name}'")
        print(f"  User 2: ID={u2.id}, Name='{u2.name}'")
        
        target_user = User.objects.get(pk=target_user_id)
        print(f"Target User: ID={target_user.id}, Name='{target_user.name}'")
        
        is_participant = target_user in [u1, u2]
        print(f"Is Participant? {is_participant}")
        
        if not is_participant:
            print("FAILURE: User is NOT a participant!")
        else:
            print("SUCCESS: User IS a participant.")
            
    except Session.DoesNotExist:
        print(f"Session {session_id} DOES NOT EXIST.")
    except User.DoesNotExist:
        print(f"User {target_user_id} DOES NOT EXIST.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_session(1, 1)
