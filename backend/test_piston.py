
import requests
import sys
import socket
import os

domain = "emkc.org"
print(f"Testing connection to Piston API ({domain})...")

# Check DNS
try:
    ip = socket.gethostbyname(domain)
    print(f"DNS Resolution: {domain} -> {ip}")
except Exception as e:
    print(f"DNS Resolution Failed: {e}")

# Check Proxies
print(f"Environment HTTP_PROXY: {os.environ.get('HTTP_PROXY')}")
print(f"Environment HTTPS_PROXY: {os.environ.get('HTTPS_PROXY')}")

# Check General Internet Connectivity
try:
    print("Testing connection to Google...")
    requests.get('https://www.google.com', timeout=5)
    print("SUCCESS: Internet is accessible.")
except Exception as e:
    print(f"FAILURE: Cannot reach Google. Check your internet connection. Error: {e}")

try:
    print(f"Testing connection to Piston API ({domain})...")
    response = requests.get('https://emkc.org/api/v2/piston/runtimes', timeout=10)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print("SUCCESS: Connection established.")
    else:
        print(f"FAILURE: Unexpected status code: {response.status_code}")
except Exception as e:
    print(f"CRITICAL FAILURE: {e}")
    sys.exit(1)

