from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user details."""
    
    average_rating = serializers.FloatField(read_only=True, allow_null=True)
    total_reviews = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'name',
            'credits',
            'is_online',
            'availability',
            'date_joined',
            'average_rating',
            'total_reviews',
        ]
        read_only_fields = ['id', 'email', 'credits', 'date_joined']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""
    
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = User
        fields = ['email', 'name', 'password', 'password_confirm']
    
    def validate_name(self, value):
        if User.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError('This name is already taken.')
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match.'
            })
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            email=validated_data['email'],
            name=validated_data['name'],
            password=validated_data['password']
        )
        
        # Record signup bonus transaction
        from ..models import CreditTransaction
        CreditTransaction.objects.create(
            user=user,
            amount=user.credits,
            transaction_type='SIGNUP',
            balance_after=user.credits,
            description='Welcome bonus credits'
        )
        
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile."""
    
    class Meta:
        model = User
        fields = ['name', 'availability']


class UserPublicSerializer(serializers.ModelSerializer):
    """Public serializer for user info (no sensitive data)."""
    
    average_rating = serializers.FloatField(read_only=True, allow_null=True)
    total_reviews = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id',
            'name',
            'is_online',
            'availability',
            'average_rating',
            'total_reviews',
        ]
