import os

from flask import Blueprint, request, jsonify, session, Request

from utils.env_validator import get_settings
from app.challenge import token_required, get_user_by_token

from pony.orm import commit, db_session
from utils.ormconfig import User, Article

settings = get_settings()

app = Blueprint("article", __name__)


@app.route("/article/<article_id>", methods=["GET"])
@db_session
def get_article(article_id: str):
    article = Article.get(id=article_id)
    if not article:
        return jsonify({"error": "Article not found"}), 404

    return jsonify(
        {
            "id": article.id,
            "title": article.title,
            "content": article.content,
            "authorName": article.author_name,
            "authorHandle": article.author.username if article.author else None,
            "createdAt": article.created_at.isoformat(),
            "updatedAt": article.updated_at.isoformat() if article.updated_at else None,
        }
    )


@app.route("/article", methods=["POST"])
@db_session
def create_article():
    data = request.get_json()
    if not data or "title" not in data or "content" not in data:
        return jsonify({"error": "Title and content are required"}), 400

    user = None
    auth_header = request.headers.get("Authorization")
    if auth_header:
        try:
            user = get_user_by_token(auth_header)
        except Exception as _:
            pass

    created_article = Article(
        id=os.urandom(16).hex(),
        title=data["title"],
        content=data["content"],
        author=user,
        author_name=data["authorName"],
    )
    commit()
    return (
        jsonify(
            {
                "message": "Article created successfully",
                "success": True,
                "articleId": created_article.id,
            }
        ),
        201,
    )
