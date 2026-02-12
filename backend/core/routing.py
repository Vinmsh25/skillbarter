"""
WebSocket URL routing for Django Channels.
"""

from django.urls import re_path
from .consumers import PresenceConsumer, ChatConsumer, SessionConsumer

websocket_urlpatterns = [
    # Presence: online/offline status
    re_path(r'ws/presence/$', PresenceConsumer.as_asgi()),
    
    # Chat: messaging within a session
    re_path(r'ws/chat/(?P<session_id>\d+)/$', ChatConsumer.as_asgi()),
    
    # Session: timer sync and credit updates
    re_path(r'ws/session/(?P<session_id>\d+)/$', SessionConsumer.as_asgi()),
]

print("DEBUG: routing.py loaded websocket_urlpatterns")
