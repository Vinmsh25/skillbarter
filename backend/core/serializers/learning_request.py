from rest_framework import serializers
from ..models import LearningRequestPost


class LearningRequestPostSerializer(serializers.ModelSerializer):
    """Serializer for reading learning request posts."""
    
    creator_name = serializers.CharField(source='creator.name', read_only=True)
    creator_id = serializers.IntegerField(source='creator.id', read_only=True)
    creator_rating = serializers.FloatField(source='creator.average_rating', read_only=True)
    
    class Meta:
        model = LearningRequestPost
        fields = [
            'id',
            'creator_id',
            'creator_name',
            'creator_rating',
            'topic_to_learn',
            'topic_to_teach',
            'ok_with_just_learning',
            'bounty_enabled',
            'created_at',
            'is_completed',
        ]
        read_only_fields = ['id', 'created_at', 'is_completed']


class LearningRequestPostCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating learning request posts."""
    
    class Meta:
        model = LearningRequestPost
        fields = [
            'topic_to_learn',
            'topic_to_teach',
            'ok_with_just_learning',
            'bounty_enabled',
        ]
    
    def validate_topic_to_learn(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Topic to learn is required.')
        return value.strip()
    
    def validate_topic_to_teach(self, value):
        if value:
            return value.strip()
        return ''
    
    def validate(self, attrs):
        request = self.context.get('request')
        if request and request.user:
            topic = attrs.get('topic_to_learn', '').strip()
            existing = LearningRequestPost.objects.filter(
                creator=request.user,
                topic_to_learn__iexact=topic,
                is_completed=False
            ).exists()
            if existing:
                raise serializers.ValidationError(
                    f'You already have an active post for "{topic}". Mark it as done first or search for a different topic.'
                )
        return attrs

    def create(self, validated_data):
        validated_data['creator'] = self.context['request'].user
        return super().create(validated_data)
