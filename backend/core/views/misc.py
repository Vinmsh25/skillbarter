import requests
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.conf import settings

@api_view(['POST'])
@permission_classes([AllowAny])
def execute_code(request):
    """
    Proxy request to Piston API to avoid CORS issues.
    Expects: { language: str, files: [{ content: str }] }
    """
    try:
        # print(f"DEBUG: execute_code data: {request.data}")
        # Forward the request to Piston
        try:
            response = requests.post(
                'https://emkc.org/api/v2/piston/execute',
                json=request.data,
                headers={'Content-Type': 'application/json'},
                timeout=5 # Reduced timeout for faster feedback
            )
        except requests.Timeout:
            # Fallback or detailed error
            return Response(
                {'message': 'Connection to Code Execution Engine timed out. Please check your internet connection or firewall.', 'error': 'Timeout connecting to emkc.org'},
                status=504
            )
        # print(f"DEBUG: Piston response status: {response.status_code}")
        # print(f"DEBUG: Piston response text: {response.text}")
        
        try:
            data = response.json()
        except ValueError:
            data = {'output': response.text}
            
        return Response(data, status=response.status_code)
        
    except requests.RequestException as e:
        print(f"ERROR: Piston request failed: {e}")
        return Response(
            {'message': 'Failed to communicate with execution engine', 'error': str(e)},
            status=503
        )
    except Exception as e:
        print(f"ERROR: Unexpected error in execute_code: {e}")
        return Response(
            {'message': 'Internal Server Error during execution', 'error': str(e)},
            status=500
        )
