from flask import Blueprint, request, jsonify
import os
import base64

from webauthn.helpers.cose import COSEAlgorithmIdentifier

from utils.ormconfig import User
from pony.orm import db_session
from webauthn import generate_registration_options, verify_registration_response
from webauthn.helpers.structs import (
    RegistrationCredential,
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    AttestationConveyancePreference,
    AuthenticatorAttachment,
    AuthenticatorAttestationResponse,
)
from utils.env_validator import get_settings

settings = get_settings()

app = Blueprint("challenge", __name__)
challenge_cache = {}


def b64encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("utf-8")


def b64decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


@app.post("/auth/challenge")
@db_session
def auth_challenge():
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
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        supported_pub_key_algs=[
            COSEAlgorithmIdentifier.ECDSA_SHA_256,
            COSEAlgorithmIdentifier.RSASSA_PKCS1_v1_5_SHA_256,
        ],
        attestation=AttestationConveyancePreference.DIRECT,
    )

    challenge_cache[options.challenge] = user_id

    return jsonify(options), 200


@app.post("/auth/register")
@db_session
def auth_register():
    data = request.get_json()
    challenge = data.get("challenge")
    if not challenge or challenge not in challenge_cache:
        return {"error": "Invalid or expired challenge"}, 400

    user_id = challenge_cache.pop(challenge)

    username = data.get("username")
    if not username:
        return {"error": "Username is required"}, 400

    credential_data = data.get("credential")
    if not credential_data:
        return {"error": "Credential data is required"}, 400

    try:
        registration_credential = RegistrationCredential(
            id=credential_data["id"],
            raw_id=b64decode(credential_data["rawId"]),
            response=AuthenticatorAttestationResponse(
                client_data_json=b64decode(
                    credential_data["response"]["clientDataJSON"]
                ),
                attestation_object=b64decode(
                    credential_data["response"]["attestationObject"]
                ),
            ),
            type=credential_data["type"],
        )

        verification = verify_registration_response(
            credential=registration_credential,
            expected_rp_id=settings.HOSTNAME,
            expected_origin=settings.ORIGIN,
            expected_challenge=challenge,
        )

        _user_create = User(
            id=b64encode(user_id),
            username=username,
            credential_id=verification.credential_id,
            public_key=verification.credential_public_key,
            sign_count=verification.sign_count,
        )

        return {"status": "User registered successfully"}, 200

    except Exception as e:
        return {"error": f"Registration verification failed: {str(e)}"}, 400
