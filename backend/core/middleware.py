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
        try:
            # Get token from query string
            query_string = scope.get('query_string', b'').decode()
            token = None
            
            if query_string:
                from urllib.parse import parse_qs
                params = parse_qs(query_string)
                if 'token' in params:
                    token = params['token'][0]
            
            # If no token in query, check subprotocols
            if not token:
                subprotocols = scope.get('subprotocols', [])
                for protocol in subprotocols:
                    if protocol.startswith('access_token_'):
                        token = protocol.replace('access_token_', '')
                        break
            
            # Authenticate user
            if token:
                user = await get_user_from_token(token)
                scope['user'] = user
            else:
                scope['user'] = AnonymousUser()
        except Exception as e:
            # Fallback to anonymous user on any error to prevent crash
            print(f"JWT Middleware Error: {e}")
            scope['user'] = AnonymousUser()
        
        return await super().__call__(scope, receive, send)
