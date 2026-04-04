from app import create_app
from db import check_schema

warnings = check_schema()
if warnings:
    print("\n⚠️  SCHEMA WARNINGS — run migrate.py before starting the app:")
    for w in warnings:
        print(f"   • {w}")
    print()

app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)
