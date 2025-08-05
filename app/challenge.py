from flask import Blueprint, request, jsonify, session, Request
import os
import base64
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps

from webauthn.helpers.cose import COSEAlgorithmIdentifier

from utils.ormconfig import User
from pony.orm import db_session
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
)
from webauthn.helpers.structs import (
    RegistrationCredential,
    AuthenticatorSelectionCriteria,
    AuthenticatorAttachment,
    AuthenticatorAttestationResponse,
    UserVerificationRequirement,
    AuthenticationCredential,
    AuthenticatorAssertionResponse,
)
from webauthn.helpers.options_to_json import options_to_json_dict
from utils.env_validator import get_settings

from pony.orm import commit

settings = get_settings()

app = Blueprint("challenge", __name__)
challenge_cache = {}


def generate_jwt_token(user_id: str, username: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": now + timedelta(hours=24),
        "iat": now,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def verify_jwt_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise Exception("Token has expired")


def b64encode(b: bytes) -> str:
    return base64.b64encode(b).decode("utf-8")


def b64decode(s: str) -> bytes:
    return base64.b64decode(s)


def bytes_to_base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def base64url_to_bytes_fix(data: str) -> bytes:
    rem = len(data) % 4
    if rem > 0:
        data += "=" * (4 - rem)
    return base64.urlsafe_b64decode(data)


def token_required(f):
    @wraps(f)
    @db_session
    def decorated_function(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token:
            return {"error": "Token is missing"}, 401

        if token.startswith("Bearer "):
            token = token[7:]

        try:
            payload = verify_jwt_token(token)
            kwargs["user"] = User.get(id=payload["user_id"])
        except Exception as e:
            return {"error": f"Invalid token: {str(e)}"}, 401
        return f(*args, **kwargs)

    return decorated_function


@app.post("/auth/token/refresh")
@db_session
def refresh_token():
    token = request.headers.get("Authorization")
    if not token:
        return {"error": "Token is missing"}, 401

    try:
        payload = verify_jwt_token(token)
        user = User.get(id=payload["user_id"])
        if not user:
            return {"error": "Authentication Error, Token is invalid"}, 400

        new_token = generate_jwt_token(user.id, user.username)
        return {"token": new_token}, 200
    except Exception as e:
        return {"error": f"Token refresh failed: {str(e)}"}, 401


@app.post("/auth/verify")
@token_required
def verify_token(user: User):
    return {
        "valid": True,
        "user": {"id": user.id, "username": user.username},
    }, 200


@app.post("/auth/id")
@db_session
def auth_id():
    data = request.get_json()
    username = data.get("username")

    if not username:
        return {"error": "Username is required"}, 400

    if not User.exists(username=username):
        return "false", 200

    return "true", 200


@app.post("/auth/login/challenge")
@db_session
def auth_login_challenge():
    data = request.get_json()
    username = data.get("username")
    if not username:
        return {"error": "Username is required"}, 400

    user = User.get(username=username)
    if not user:
        return {"error": "User not found"}, 404

    options = generate_authentication_options(
        rp_id=settings.HOSTNAME,
        user_verification=UserVerificationRequirement.PREFERRED,
        allow_credentials=[],
        timeout=60000,
    )
    session["challenge"] = options.challenge

    return jsonify(options_to_json_dict(options=options)), 200


@app.post("/auth/login")
@db_session
def auth_login():
    data = request.get_json()

    expected_challenge = session.get("challenge")
    expected_origin = request.environ.get("HTTP_ORIGIN")

    if not data:
        return {"error": "Credential data is required"}, 400

    user = User.get(credential_id=base64url_to_bytes_fix(data["id"]))
    if not user:
        return {"error": "Passkey verification failed"}, 400
    if not user.credential_id == base64url_to_bytes_fix(data["id"]):
        return {"error": "Invalid credential"}, 400

    try:
        credential = AuthenticationCredential(
            id=data["id"],
            raw_id=base64url_to_bytes_fix(data["rawId"]),
            type=data["type"],
            response=AuthenticatorAssertionResponse(
                client_data_json=base64url_to_bytes_fix(
                    data["response"]["clientDataJSON"],
                ),
                authenticator_data=base64url_to_bytes_fix(
                    data["response"]["authenticatorData"],
                ),
                signature=base64url_to_bytes_fix(
                    data["response"]["signature"],
                ),
                user_handle=base64url_to_bytes_fix(
                    data["response"].get("userHandle", b"")
                ),
            ),
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
        )
        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=expected_challenge,
            expected_rp_id=settings.HOSTNAME,
            expected_origin=expected_origin,
            require_user_verification=False,
            credential_public_key=user.public_key,
            credential_current_sign_count=user.sign_count,
        )
        user.sign_count = verification.new_sign_count
        commit()

        token = generate_jwt_token(user.id, user.username)

        return {
            "status": "User login successfully",
            "success": True,
            "token": token,
            "user": {"id": user.id, "username": user.username},
        }, 200

    except Exception as e:
        return {"error": f"Authentication verification failed: {str(e)}"}, 400


@app.post("/auth/register/challenge")
@db_session
def auth_register_challenge():
    data = request.get_json()
    username = data.get("username")
    if not username:
        return {"error": "Username is required"}, 400

    if User.exists(username=username):
        return {"error": "Username already exists"}, 400

    user_id = os.urandom(16)

    options = generate_registration_options(
        rp_name="Krost",
        rp_id=settings.HOSTNAME,
        user_id=user_id,
        user_name=username,
        user_display_name=username,
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            require_resident_key=True,
        ),
        supported_pub_key_algs=[
            COSEAlgorithmIdentifier.ECDSA_SHA_256,
            COSEAlgorithmIdentifier.RSASSA_PKCS1_v1_5_SHA_256,
        ],
        exclude_credentials=[],
    )
    challenge_cache[options.challenge] = user_id

    return jsonify(options_to_json_dict(options=options)), 200


@app.post("/auth/register")
@db_session
def auth_register():
    data = request.get_json()
    challenge = data.get("challenge")
    if not challenge:
        return {"error": "Invalid or expired challenge"}, 400

    username = data.get("username")
    if not username:
        return {"error": "Username is required"}, 400

    credential_data = data.get("credential")
    if not credential_data:
        return {"error": "Credential data is required"}, 400

    try:
        registration_credential = RegistrationCredential(
            id=credential_data["id"],
            raw_id=base64url_to_bytes_fix(credential_data["rawId"]),
            response=AuthenticatorAttestationResponse(
                client_data_json=base64url_to_bytes_fix(
                    credential_data["response"]["clientDataJSON"]
                ),
                attestation_object=base64url_to_bytes_fix(
                    credential_data["response"]["attestationObject"]
                ),
            ),
            type=credential_data["type"],
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
        )

        verification = verify_registration_response(
            credential=registration_credential,
            expected_rp_id=settings.HOSTNAME,
            expected_origin=settings.ORIGIN,
            expected_challenge=base64url_to_bytes_fix(challenge),
            require_user_verification=True,
        )

        user_create = User(
            id=data.get("userId"),
            username=username,
            credential_id=verification.credential_id,
            public_key=verification.credential_public_key,
            sign_count=verification.sign_count,
        )
        commit()

        token = generate_jwt_token(user_create.id, user_create.username)

        return {
            "status": "User registered successfully",
            "success": True,
            "token": token,
            "user": {"id": user_create.id, "username": user_create.username},
        }, 200

    except Exception as e:
        return {"error": f"Registration verification failed: {str(e)}"}, 400