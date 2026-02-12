import os
import django
import sys

# Add the backend directory to the python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')
django.setup()

from core.models import Session

active_sessions = Session.objects.filter(is_active=True)
count = active_sessions.count()
print(f"Found {count} active sessions.")

for session in active_sessions:
    print(f"Ending session {session.id}...")
    session.end_session()

print("All active sessions ended.")
