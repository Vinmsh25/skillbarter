from rest_framework import serializers
from django.contrib.auth import get_user_model
from ..models import Session, SessionTimer, LearningRequestPost

User = get_user_model()


class SessionTimerSerializer(serializers.ModelSerializer):
    """Serializer for session timers."""
    
    teacher_name = serializers.CharField(source='teacher.name', read_only=True)
    is_running = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = SessionTimer
        fields = [
            'id',
            'teacher',
            'teacher_name',
            'start_time',
            'end_time',
            'duration_seconds',
            'is_running',
        ]
        read_only_fields = ['id', 'start_time', 'end_time', 'duration_seconds']


class SessionSerializer(serializers.ModelSerializer):
    """Serializer for reading session details."""
    
    user1_name = serializers.CharField(source='user1.name', read_only=True)
    user2_name = serializers.CharField(source='user2.name', read_only=True)
    user1_teaching_time = serializers.SerializerMethodField()
    user2_teaching_time = serializers.SerializerMethodField()
    active_timer = serializers.SerializerMethodField()
    total_duration = serializers.FloatField(read_only=True)
    
    class Meta:
        model = Session
        fields = [
            'id',
            'user1',
            'user1_name',
            'user2',
            'user2_name',
            'learning_request',
            'start_time',
            'end_time',
            'is_active',
            'total_duration',
            'user1_teaching_time',
            'user2_teaching_time',
            'active_timer',
        ]
        read_only_fields = ['id', 'start_time', 'end_time', 'is_active']
    
    def get_user1_teaching_time(self, obj):
        return obj.get_teaching_time(obj.user1)
    
    def get_user2_teaching_time(self, obj):
        return obj.get_teaching_time(obj.user2)
    
    def get_active_timer(self, obj):
        timer = obj.get_active_timer()
        if timer:
            return SessionTimerSerializer(timer).data
        return None


class SessionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating sessions."""
    
    user2 = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    learning_request = serializers.PrimaryKeyRelatedField(
        queryset=LearningRequestPost.objects.filter(is_completed=False),
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = Session
        fields = ['id', 'user2', 'learning_request']
        read_only_fields = ['id']
    
    def validate_user2(self, value):
        request_user = self.context['request'].user
        if value == request_user:
            raise serializers.ValidationError('Cannot create session with yourself.')
        return value

    def validate(self, attrs):
        user1 = self.context['request'].user
        user2 = attrs['user2']
        # Check for existing active session between these two users
        from django.db.models import Q
        existing = Session.objects.filter(
            Q(user1=user1, user2=user2) | Q(user1=user2, user2=user1),
            is_active=True
        ).exists()
        if existing:
            raise serializers.ValidationError('An active session already exists between you and this user.')
        return attrs

    def create(self, validated_data):
        validated_data['user1'] = self.context['request'].user
        return super().create(validated_data)

