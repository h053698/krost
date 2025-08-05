import os

from flask import Blueprint, request, jsonify, session, Request

from utils.env_validator import get_settings
from app.challenge import token_required, get_user_by_token

from pony.orm import commit, db_session
from utils.ormconfig import User, Article

settings = get_settings()

app = Blueprint("article", __name__)


@app.route("/article", methods=["POST"])
@db_session
def create_article():
    data = request.get_json()
    if not data or "title" not in data or "content" not in data:
        return jsonify({"error": "Title and content are required"}), 400

    user = get_user_by_token(request.headers.get("Authorization"))
    created_article = Article(
        id=os.urandom(16).hex(),
        title=data["title"],
        content=data["content"],
        author=user,
        author_name=user.username,
    )
    commit()
    return (
        jsonify(
            {
                "message": "Article created successfully",
                "success": True,
                "article": {
                    "id": created_article.id,
                    "title": data["title"],
                    "content": data["content"],
                    "author": user.username,
                },
            }
        ),
        201,
    )
