from rest_framework import serializers
from ..models import CreditTransaction


class CreditTransactionSerializer(serializers.ModelSerializer):
    """Serializer for credit transaction history."""
    
    user_name = serializers.CharField(source='user.name', read_only=True)
    session_id = serializers.IntegerField(source='session.id', read_only=True, allow_null=True)
    
    class Meta:
        model = CreditTransaction
        fields = [
            'id',
            'user',
            'user_name',
            'session',
            'session_id',
            'amount',
            'transaction_type',
            'balance_after',
            'description',
            'created_at',
        ]
        read_only_fields = fields
