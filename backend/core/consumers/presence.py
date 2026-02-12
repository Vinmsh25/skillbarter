from channels.db import database_sync_to_async
from .base import BaseConsumer


class PresenceConsumer(BaseConsumer):
    """
    WebSocket consumer for online/offline presence.
    
    - On connect: Mark user as online, broadcast to all
    - On disconnect: Mark user as offline, broadcast to all
    - On heartbeat: Update last seen timestamp
    
    Group: 'presence' (global group for all connected users)
    """
    
    presence_group = 'presence'
    
    async def get_groups(self):
        return [self.presence_group]
    
    async def on_connected(self):
        """Mark user as online and broadcast."""
        try:
            if not self.user.is_authenticated:
                print("DEBUG: PresenceConsumer - Anonymous user connected, ignoring")
                return

            print(f"DEBUG: PresenceConsumer.on_connected for user {self.user.id}")
            
            # Simple online status update (no counting)
            await self.set_user_online(True)
            
            user_data = await self.get_user_data(self.user)
            
            # Broadcast user online status to all users
            await self.broadcast_to_group(
                self.presence_group,
                'presence_update',
                {
                    'user': user_data,
                    'status': 'online'
                }
            )
            
            # Send current online users to this connection
            online_users = await self.get_online_users()
            await self.send_json({
                'type': 'online_users',
                'users': online_users
            })
        except Exception as e:
            import traceback
            print(f"ERROR: PresenceConsumer.on_connected failed: {e}")
            traceback.print_exc()
            await self.close(code=4002)
    
    async def on_disconnected(self):
        """Mark user as offline and broadcast."""
        if not self.user.is_authenticated:
            return

        # Simple offline status update
        await self.set_user_online(False)
        
        user_data = await self.get_user_data(self.user)
        
        await self.broadcast_to_group(
            self.presence_group,
            'presence_update',
            {
                'user': user_data,
                'status': 'offline'
            }
        )
    
    async def handle_heartbeat(self, data):
        """Handle heartbeat message to keep connection alive."""
        # Optional: You could update a 'last_seen' timestamp here if needed
        # await self.update_last_seen()
        await self.send_json({
            'type': 'heartbeat_ack',
            'timestamp': data.get('timestamp')
        })
    
    async def presence_update(self, event):
        """Handle presence update broadcast from group."""
        await self.send_json({
            'type': 'presence_update',
            'user': event['user'],
            'status': event['status']
        })
    
    @database_sync_to_async
    def set_user_online(self, is_online):
        """Update user's online status in database."""
        self.user.is_online = is_online
        self.user.save(update_fields=['is_online'])
        
    @database_sync_to_async
    def get_online_users(self):
        """Get list of currently online users."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        online_users = User.objects.filter(is_online=True).values(
            'id', 'name', 'email', 'availability'
        )
        return list(online_users)
