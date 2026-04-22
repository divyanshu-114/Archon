import os
import requests
import webbrowser
from flask import Flask, request
from dotenv import load_dotenv
import threading

load_dotenv()

CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID")
CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET")
REDIRECT_URI = os.getenv("LINKEDIN_REDIRECT_URI")

SCOPE = "w_member_social r_liteprofile"

AUTH_URL = (
    f"https://www.linkedin.com/oauth/v2/authorization"
    f"?response_type=code"
    f"&client_id={CLIENT_ID}"
    f"&redirect_uri={REDIRECT_URI}"
    f"&scope={SCOPE.replace(' ', '%20')}"
)

app = Flask(__name__)

access_token = None

@app.route("/callback")
def callback():
    global access_token

    code = request.args.get("code")

    if not code:
        return "Error: No authorization code received.", 400

    token_response = requests.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )

    token_data = token_response.json()

    if "access_token" in token_data:
        access_token = token_data["access_token"]
        expires_in = token_data.get("expires_in", "unknown")

        print("\n" + "="*60)
        print("✅ SUCCESS! YOUR LINKEDIN ACCESS TOKEN:")
        print("="*60)
        print(f"\n{access_token}\n")
        print(f"⏰ Expires in: {expires_in} seconds (~60 days)")
        print("\n👉 Copy this token and add it to your .env file as:")
        print("LINKEDIN_ACCESS_TOKEN=your_token_here")
        print("="*60 + "\n")

        shutdown = request.environ.get("werkzeug.server.shutdown")
        if shutdown:
            shutdown()

        return """
        <h1>✅ Authentication Successful!</h1>
        <p>Your access token has been printed in the terminal.</p>
        <p>Copy it and add it to your .env file.</p>
        <p>You can close this browser tab now.</p>
        """, 200
    else:
        print(f"❌ Token exchange failed: {token_data}")
        return f"Error getting token: {token_data}", 400


def open_browser():
    import time
    time.sleep(1.5)
    print(f"\n🌐 Opening LinkedIn login in your browser...")
    print(f"If it doesn't open automatically, visit:\n{AUTH_URL}\n")
    webbrowser.open(AUTH_URL)


if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 ARCHON LinkedIn Authentication")
    print("="*60)
    print("Starting local server on http://localhost:8000")
    print("A browser window will open for you to log in to LinkedIn")
    print("="*60 + "\n")

    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()

    app.run(host="0.0.0.0", port=8000, debug=False)
