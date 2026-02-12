from django.contrib import admin
from .models import User, LearningRequestPost, Session, SessionTimer, Review, CreditTransaction, Bank


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'credits', 'is_online', 'is_active', 'date_joined')
    list_filter = ('is_online', 'is_active', 'is_staff')
    search_fields = ('email', 'name')
    ordering = ('-date_joined',)
    readonly_fields = ('date_joined', 'last_login')


@admin.register(LearningRequestPost)
class LearningRequestPostAdmin(admin.ModelAdmin):
    list_display = ('creator', 'topic_to_learn', 'topic_to_teach', 'is_completed', 'created_at')
    list_filter = ('is_completed', 'ok_with_just_learning', 'bounty_enabled')
    search_fields = ('topic_to_learn', 'topic_to_teach', 'creator__email')
    ordering = ('-created_at',)


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user1', 'user2', 'start_time', 'end_time', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('user1__email', 'user2__email')
    ordering = ('-start_time',)


@admin.register(SessionTimer)
class SessionTimerAdmin(admin.ModelAdmin):
    list_display = ('session', 'teacher', 'start_time', 'end_time', 'duration_seconds')
    ordering = ('-start_time',)


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('session', 'reviewer', 'reviewee', 'rating', 'created_at')
    list_filter = ('rating',)
    search_fields = ('reviewer__email', 'reviewee__email')
    ordering = ('-created_at',)


@admin.register(CreditTransaction)
class CreditTransactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'amount', 'transaction_type', 'session', 'created_at')
    list_filter = ('transaction_type',)
    search_fields = ('user__email',)
    ordering = ('-created_at',)


@admin.register(Bank)
class BankAdmin(admin.ModelAdmin):
    list_display = ('id', 'total_credits', 'updated_at')
    readonly_fields = ('total_credits', 'updated_at')
