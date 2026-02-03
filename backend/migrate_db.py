"""
Скрипт миграции данных из smm_agent.db в yadro.db

Копирует:
- memory_items (каналы, конкуренты, стили)
- llm_costs (статистика использования)

Запуск: python migrate_db.py
"""
import sqlite3
import os
from datetime import datetime


def migrate():
    src_path = "data/smm_agent.db"
    dst_path = "data/yadro.db"

    if not os.path.exists(src_path):
        print(f"[SKIP] Source database not found: {src_path}")
        return

    if not os.path.exists(dst_path):
        print(f"[ERROR] Destination database not found: {dst_path}")
        return

    print(f"[INFO] Migrating from {src_path} to {dst_path}")
    print(f"[INFO] Started at {datetime.now()}")

    src = sqlite3.connect(src_path)
    dst = sqlite3.connect(dst_path)

    src.row_factory = sqlite3.Row
    dst.row_factory = sqlite3.Row

    # 1. Проверяем структуру таблиц
    src_tables = set(r[0] for r in src.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall())

    dst_tables = set(r[0] for r in dst.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall())

    print(f"[INFO] Source tables: {src_tables}")
    print(f"[INFO] Dest tables: {dst_tables}")

    # 2. Мигрируем memory_items
    if "memory_items" in src_tables and "memory_items" in dst_tables:
        print("\n[MIGRATE] memory_items...")

        # Получаем существующие ID в destination
        existing_ids = set(r[0] for r in dst.execute(
            "SELECT id FROM memory_items"
        ).fetchall())

        # Копируем новые записи
        rows = src.execute("SELECT * FROM memory_items").fetchall()
        copied = 0
        skipped = 0

        for row in rows:
            row_dict = dict(row)
            if row_dict["id"] in existing_ids:
                skipped += 1
                continue

            try:
                columns = ", ".join(row_dict.keys())
                placeholders = ", ".join(["?" for _ in row_dict])
                dst.execute(
                    f"INSERT INTO memory_items ({columns}) VALUES ({placeholders})",
                    list(row_dict.values())
                )
                copied += 1
            except sqlite3.IntegrityError as e:
                print(f"  [WARN] Skip duplicate: {e}")
                skipped += 1

        dst.commit()
        print(f"  Copied: {copied}, Skipped: {skipped}")

    # 3. Мигрируем llm_costs (если есть)
    if "llm_costs" in src_tables and "llm_costs" in dst_tables:
        print("\n[MIGRATE] llm_costs...")

        rows = src.execute("SELECT * FROM llm_costs").fetchall()
        copied = 0

        for row in rows:
            row_dict = dict(row)
            try:
                # Убираем id для автоинкремента
                if "id" in row_dict:
                    del row_dict["id"]

                columns = ", ".join(row_dict.keys())
                placeholders = ", ".join(["?" for _ in row_dict])
                dst.execute(
                    f"INSERT INTO llm_costs ({columns}) VALUES ({placeholders})",
                    list(row_dict.values())
                )
                copied += 1
            except sqlite3.IntegrityError:
                pass

        dst.commit()
        print(f"  Copied: {copied}")

    # 4. Показываем итог
    print("\n[DONE] Migration complete!")

    src_count = src.execute("SELECT COUNT(*) FROM memory_items").fetchone()[0]
    dst_count = dst.execute("SELECT COUNT(*) FROM memory_items").fetchone()[0]

    print(f"  Source memory_items: {src_count}")
    print(f"  Dest memory_items: {dst_count}")

    src.close()
    dst.close()


if __name__ == "__main__":
    migrate()
