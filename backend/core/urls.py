"""
URL configuration for core app.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    SignupView,
    LoginView,
    LogoutView,
    UserMeView,
    UserDetailView,
    UserListView,
    LearningRequestPostViewSet,
    SessionViewSet,
    BankSupportView,
    ReviewViewSet,
    CreditTransactionListView,
    CreditBalanceView,
)

# Create router for viewsets
router = DefaultRouter()
router.register(r'posts', LearningRequestPostViewSet, basename='post')
router.register(r'sessions', SessionViewSet, basename='session')

urlpatterns = [
    # Authentication
    path('auth/signup/', SignupView.as_view(), name='signup'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # User profile
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/me/', UserMeView.as_view(), name='user-me'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    
    # Credit endpoints
    path('credits/', CreditBalanceView.as_view(), name='credit-balance'),
    path('credits/transactions/', CreditTransactionListView.as_view(), name='credit-transactions'),
    
    # Bank support
    path('bank/support/', BankSupportView.as_view(), name='bank-support'),
    
    # Session reviews (nested under sessions)
    path(
        'sessions/<int:session_pk>/reviews/',
        ReviewViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='session-reviews'
    ),
    
    # User reviews (public - reviews received by a user)
    path(
        'users/<int:user_pk>/reviews/',
        ReviewViewSet.as_view({'get': 'list'}),
        name='user-reviews'
    ),
    
    # Router URLs (posts, sessions)
    path('', include(router.urls)),
]

