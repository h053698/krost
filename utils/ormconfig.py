from pony.orm import Database, PrimaryKey, Required, Optional
from utils.env_validator import get_settings

__all__ = ["database"]

settings = get_settings()

database = Database()
database.bind(
    provider="postgres",
    user=settings.DATABASE_USER,
    password=settings.DATABASE_PASSWORD,
    host=settings.DATABASE_HOST,
    database=settings.DATABASE_NAME,
)


class User(database.Entity):
    id = PrimaryKey(str)
    username = Required(str, unique=True)
    credential_id = Optional(bytes)
    public_key = Optional(bytes)
    sign_count = Optional(int, default=0)


database.generate_mapping(create_tables=True)
