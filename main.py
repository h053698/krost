from flask import Flask, render_template, redirect
from pony.orm import db_session

from utils.ormconfig import User as _, Article
from app.challenge import app as challenge_app
from app.article import app as article_app
from utils.env_validator import get_settings

settings = get_settings()

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = settings.SESSION_KEY
app.register_blueprint(challenge_app)
app.register_blueprint(article_app)


@app.route("/")
def editor():
    return render_template("index.html")


@app.route("/<article_id>")
def show_article(article_id):
    return render_template("article.html")


@app.route("/<article_id>/edit")
def edit_article(article_id):
    return render_template("edit.html")


@app.errorhandler(404)
def not_found(_error):
    return redirect("/404")


if __name__ == "__main__":
    with db_session:
        article = Article.get(id="404")
        if not article:
            article = Article(
                id="404",
                title="Page Not Found",
                content="The page you are looking for does not exist.",
                author_name="System",
            )

    app.run(debug=True, host="0.0.0.0", port=5001)
