from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


@database_sync_to_async
def get_user_from_token(token_key):
    """Get user from JWT token."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    try:
        access_token = AccessToken(token_key)
        user_id = access_token['user_id']
        return User.objects.get(id=user_id)
    except (InvalidToken, TokenError, User.DoesNotExist):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    JWT authentication middleware for Django Channels WebSocket connections.
    
    Token can be passed via:
    1. Query parameter: ws://host/ws/path/?token=<jwt_token>
    2. Subprotocol: Sec-WebSocket-Protocol header
    """
    
    async def __call__(self, scope, receive, send):
        print(f"DEBUG: JWTAuthMiddleware called for path: {scope.get('path')}")
        # Get token from query string
        query_string = scope.get('query_string', b'').decode()
        token = None
        
        if query_string:
            params = dict(param.split('=') for param in query_string.split('&') if '=' in param)
            token = params.get('token')
        
        # If no token in query, check subprotocols
        if not token:
            subprotocols = scope.get('subprotocols', [])
            for protocol in subprotocols:
                if protocol.startswith('access_token_'):
                    token = protocol.replace('access_token_', '')
                    break
        
        # Authenticate user
        if token:
            print(f"DEBUG: JWTAuthMiddleware found token: {token[:10]}...")
            user = await get_user_from_token(token)
            print(f"DEBUG: JWTAuthMiddleware resolved user: {user} (ID: {user.id if hasattr(user, 'id') else 'None'})")
            scope['user'] = user
        else:
            print("DEBUG: JWTAuthMiddleware - No token found")
            scope['user'] = AnonymousUser()
        
        return await super().__call__(scope, receive, send)
