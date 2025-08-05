from flask import Flask, render_template, redirect
from utils.ormconfig import User as _
from app.challenge import app as challenge_app
from utils.env_validator import get_settings

settings = get_settings()

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = settings.SESSION_KEY
app.register_blueprint(challenge_app)


@app.route("/")
def editor():
    return render_template("index.html")


@app.route("/<int:article_id>")
def show_article(article_id: int):
    return render_template("article.html")


@app.route("/<int:article_id>/edit")
def edit_article():
    return render_template("edit.html")


@app.errorhandler(404)
def not_found(error):
    return redirect("/404")


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)
