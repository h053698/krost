from flask import Blueprint, request, jsonify
import os
import base64

from webauthn.helpers.cose import COSEAlgorithmIdentifier

from utils.ormconfig import User
from pony.orm import db_session
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
)
from webauthn.helpers.structs import (
    RegistrationCredential,
    AuthenticatorSelectionCriteria,
    AuthenticatorAttachment,
    AuthenticatorAttestationResponse,
    UserVerificationRequirement,
)
from webauthn.helpers.options_to_json import options_to_json_dict
from utils.env_validator import get_settings

settings = get_settings()

app = Blueprint("challenge", __name__)
challenge_cache = {}


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

    challenge = os.urandom(16)
    options = generate_authentication_options(
        rp_id="localhost",
        user_verification=UserVerificationRequirement.PREFERRED,
        challenge=challenge,
        allow_credentials=[],
        timeout=60000,
    )

    return jsonify(options_to_json_dict(options=options)), 200


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
        rp_id="localhost",
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
            expected_rp_id="localhost",
            expected_origin="http://localhost:5001",
            expected_challenge=base64url_to_bytes_fix(challenge),
            require_user_verification=True,
        )

        _user_create = User(
            id=data.get("userId"),
            username=username,
            credential_id=verification.credential_id,
            public_key=verification.credential_public_key,
            sign_count=verification.sign_count,
        )

        return {"status": "User registered successfully"}, 200

    except Exception as e:
        return {"error": f"Registration verification failed: {str(e)}"}, 400
