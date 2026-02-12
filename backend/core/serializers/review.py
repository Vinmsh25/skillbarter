from rest_framework import serializers
from ..models import Review


class ReviewSerializer(serializers.ModelSerializer):
    """Serializer for reading reviews."""
    
    reviewer_name = serializers.CharField(source='reviewer.name', read_only=True)
    reviewee_name = serializers.CharField(source='reviewee.name', read_only=True)
    
    class Meta:
        model = Review
        fields = [
            'id',
            'session',
            'reviewer',
            'reviewer_name',
            'reviewee',
            'reviewee_name',
            'rating',
            'comment',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ReviewCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating reviews."""
    
    class Meta:
        model = Review
        fields = ['rating', 'comment']
    
    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value
    
    def validate(self, attrs):
        session = self.context.get('session')
        reviewer = self.context['request'].user
        
        if not session:
            raise serializers.ValidationError('Session is required.')
        
        # Check if session has ended
        if session.is_active:
            raise serializers.ValidationError('Cannot review a session that is still active.')
        
        # Check if user is part of the session
        if reviewer not in [session.user1, session.user2]:
            raise serializers.ValidationError('You are not a participant in this session.')
        
        # Check if already reviewed
        if Review.objects.filter(session=session, reviewer=reviewer).exists():
            raise serializers.ValidationError('You have already reviewed this session.')
        
        return attrs
    
    def create(self, validated_data):
        session = self.context['session']
        reviewer = self.context['request'].user
        
        # Determine reviewee (the other user in the session)
        reviewee = session.user2 if reviewer == session.user1 else session.user1
        
        validated_data['session'] = session
        validated_data['reviewer'] = reviewer
        validated_data['reviewee'] = reviewee
        
        return super().create(validated_data)
