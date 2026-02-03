"""
Yadro Post - User Memory with Learning
Память пользователя с обучением на его данных

Использует SQLite с FTS5 для полнотекстового поиска
"""

import json
import sqlite3
import os
import logging
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from datetime import datetime
from abc import ABC, abstractmethod


# Простой logger без зависимостей
logger = logging.getLogger("yadro.memory")


@dataclass
class SuccessPatternDTO:
    """Успешный паттерн из истории"""
    pattern_id: int
    user_id: int
    pattern_type: str  # hook, structure, style, topic
    content: str
    topic: str
    engagement_rate: float
    views: int
    likes: int
    created_at: str
    metadata: dict


@dataclass
class UserPreferenceDTO:
    """Предпочтения пользователя"""
    user_id: int
    style: str  # casual, formal, funny
    tone: str
    emoji_usage: str  # high, medium, low
    avg_length: int
    preferred_times: List[str]


class BaseMemory(ABC):
    """Базовый класс для памяти"""

    @abstractmethod
    def remember_success(
        self,
        user_id: int,
        post_id: int,
        content: str,
        topic: str,
        metrics: Dict
    ) -> bool:
        """Запомнить успешный пост"""
        pass

    @abstractmethod
    def search_similar_success(
        self,
        user_id: int,
        topic: str,
        limit: int = 5
    ) -> List[SuccessPatternDTO]:
        """Найти похожие успешные паттерны"""
        pass

    @abstractmethod
    def get_preferences(self, user_id: int) -> Optional[UserPreferenceDTO]:
        """Получить предпочтения пользователя"""
        pass

    @abstractmethod
    def record_feedback(
        self,
        user_id: int,
        post_id: int,
        original: str,
        edited: str
    ) -> bool:
        """Записать фидбек пользователя"""
        pass


class SQLiteMemory(BaseMemory):
    """
    Память на SQLite с FTS5 для полнотекстового поиска
    """

    # Порог успешности (engagement rate > 5%)
    SUCCESS_THRESHOLD = 5.0

    def __init__(self, db_path: str = "data/user_memory.db"):
        self.db_path = db_path
        self._ensure_dir()
        self._init_db()
        logger.info(f"SQLite memory initialized: {db_path}")

    def _ensure_dir(self):
        """Создаёт директорию для БД если нужно"""
        dir_path = os.path.dirname(self.db_path)
        if dir_path and not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)

    def _init_db(self):
        """Инициализация БД с FTS5"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Таблица успешных паттернов
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS success_patterns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            pattern_type TEXT NOT NULL,
            content TEXT NOT NULL,
            topic TEXT NOT NULL,
            engagement_rate REAL DEFAULT 0,
            views INTEGER DEFAULT 0,
            likes INTEGER DEFAULT 0,
            shares INTEGER DEFAULT 0,
            comments INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata TEXT
        )
        """)

        # FTS5 виртуальная таблица для полнотекстового поиска
        cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS patterns_fts USING fts5(
            content,
            topic,
            pattern_type,
            content='success_patterns',
            content_rowid='id'
        )
        """)

        # Триггеры для синхронизации FTS5
        cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS patterns_ai AFTER INSERT ON success_patterns BEGIN
            INSERT INTO patterns_fts(rowid, content, topic, pattern_type)
            VALUES (new.id, new.content, new.topic, new.pattern_type);
        END
        """)

        cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS patterns_ad AFTER DELETE ON success_patterns BEGIN
            DELETE FROM patterns_fts WHERE rowid = old.id;
        END
        """)

        # Таблица предпочтений пользователя
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id INTEGER PRIMARY KEY,
            style TEXT DEFAULT 'casual',
            tone TEXT DEFAULT 'friendly',
            emoji_usage TEXT DEFAULT 'medium',
            avg_length INTEGER DEFAULT 200,
            preferred_times TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        # Таблица фидбека
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            post_id INTEGER,
            original_text TEXT,
            edited_text TEXT,
            edit_type TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        # Индексы
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_patterns_user ON success_patterns(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_patterns_engagement ON success_patterns(engagement_rate)")

        conn.commit()
        conn.close()

    def remember_success(
        self,
        user_id: int,
        post_id: int,
        content: str,
        topic: str,
        metrics: Dict
    ) -> bool:
        """
        Запоминает успешный пост

        Логика (в коде, не в AI!):
        1. Если engagement_rate > 5% → запоминаем
        2. Анализируем ЧТО сработало (хук, структура, стиль)
        3. Сохраняем паттерны отдельно
        """
        engagement_rate = self._calculate_engagement(metrics)

        # Порог успешности
        if engagement_rate < self.SUCCESS_THRESHOLD:
            logger.debug(f"Post {post_id} not successful enough: {engagement_rate}% < {self.SUCCESS_THRESHOLD}%")
            return False

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # Анализируем что сработало (логика в коде!)
            patterns = self._extract_patterns(content)

            for pattern in patterns:
                cursor.execute("""
                INSERT INTO success_patterns
                (user_id, pattern_type, content, topic, engagement_rate, views, likes, shares, comments, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    user_id,
                    pattern['type'],
                    pattern['content'],
                    topic,
                    engagement_rate,
                    metrics.get('views', 0),
                    metrics.get('likes', 0),
                    metrics.get('shares', 0),
                    metrics.get('comments', 0),
                    json.dumps(pattern.get('metadata', {}))
                ))

            conn.commit()

            # Обновляем предпочтения пользователя
            self._update_preferences(user_id, content, engagement_rate)

            logger.info(f"Remembered {len(patterns)} patterns for user {user_id}, engagement={engagement_rate}%")
            return True

        except Exception as e:
            logger.error(f"Error remembering success: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def _extract_patterns(self, content: str) -> List[Dict]:
        """
        Извлекает паттерны из контента

        ВАЖНО: Логика ЗДЕСЬ, в коде!
        AI НЕ решает что паттерн, код решает!
        """
        patterns = []

        # 1. Хук (первые 2 предложения)
        sentences = content.split('\n\n')
        if sentences:
            hook = sentences[0].strip()
            patterns.append({
                'type': 'hook',
                'content': hook,
                'metadata': {
                    'length': len(hook),
                    'has_question': '?' in hook,
                    'has_emoji': any(ord(c) > 127 for c in hook)
                }
            })

        # 2. Структура (количество абзацев, списки)
        structure_pattern = {
            'type': 'structure',
            'content': f"{len(sentences)} paragraphs",
            'metadata': {
                'paragraphs': len(sentences),
                'has_list': '•' in content or '-' in content,
                'total_length': len(content)
            }
        }
        patterns.append(structure_pattern)

        # 3. Стиль (эмодзи, тон)
        emoji_count = sum(1 for c in content if ord(c) > 127)
        style_pattern = {
            'type': 'style',
            'content': 'emoji_usage',
            'metadata': {
                'emoji_count': emoji_count,
                'emoji_density': emoji_count / len(content) if content else 0
            }
        }
        patterns.append(style_pattern)

        return patterns

    def _calculate_engagement(self, metrics: Dict) -> float:
        """
        Расчёт engagement rate
        Формула в коде, не в AI!
        """
        views = metrics.get('views', 0)
        if views == 0:
            return 0.0

        likes = metrics.get('likes', 0)
        shares = metrics.get('shares', 0)
        comments = metrics.get('comments', 0)

        # Взвешенная формула
        engagement = (likes * 1.0 + shares * 2.0 + comments * 3.0)
        rate = (engagement / views) * 100

        return round(rate, 2)

    def search_similar_success(
        self,
        user_id: int,
        topic: str,
        limit: int = 5
    ) -> List[SuccessPatternDTO]:
        """
        FTS5 поиск похожих успешных постов

        Возвращает паттерны которые:
        1. Пользователь сам создал (его данные!)
        2. По похожей теме
        3. С высоким engagement
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # FTS5 MATCH для полнотекстового поиска
            cursor.execute("""
            SELECT
                sp.id,
                sp.user_id,
                sp.pattern_type,
                sp.content,
                sp.topic,
                sp.engagement_rate,
                sp.views,
                sp.likes,
                sp.created_at,
                sp.metadata
            FROM success_patterns sp
            JOIN patterns_fts fts ON sp.id = fts.rowid
            WHERE sp.user_id = ?
              AND fts.topic MATCH ?
              AND sp.engagement_rate > ?
            ORDER BY sp.engagement_rate DESC
            LIMIT ?
            """, (user_id, topic, self.SUCCESS_THRESHOLD, limit))

            patterns = []
            for row in cursor.fetchall():
                patterns.append(SuccessPatternDTO(
                    pattern_id=row[0],
                    user_id=row[1],
                    pattern_type=row[2],
                    content=row[3],
                    topic=row[4],
                    engagement_rate=row[5],
                    views=row[6],
                    likes=row[7],
                    created_at=row[8],
                    metadata=json.loads(row[9]) if row[9] else {}
                ))

            return patterns

        except Exception as e:
            logger.error(f"Error searching patterns: {e}")
            return []
        finally:
            conn.close()

    def _update_preferences(
        self,
        user_id: int,
        content: str,
        engagement_rate: float
    ):
        """
        Обновляет предпочтения на основе успешного контента
        Логика в коде!
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # Анализ стиля (код определяет!)
            emoji_count = sum(1 for c in content if ord(c) > 127)
            emoji_usage = 'high' if emoji_count > 5 else 'medium' if emoji_count > 2 else 'low'

            # Средняя длина
            avg_length = len(content)

            # Тон (упрощённая эвристика в коде)
            tone = 'friendly' if emoji_count > 2 else 'professional'

            cursor.execute("""
            INSERT INTO user_preferences (user_id, emoji_usage, avg_length, tone)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                emoji_usage = ?,
                avg_length = (avg_length + ?) / 2,
                tone = ?,
                updated_at = CURRENT_TIMESTAMP
            """, (user_id, emoji_usage, avg_length, tone, emoji_usage, avg_length, tone))

            conn.commit()
        except Exception as e:
            logger.error(f"Error updating preferences: {e}")
        finally:
            conn.close()

    def get_preferences(self, user_id: int) -> Optional[UserPreferenceDTO]:
        """Получить предпочтения пользователя"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            cursor.execute("""
            SELECT user_id, style, tone, emoji_usage, avg_length, preferred_times
            FROM user_preferences
            WHERE user_id = ?
            """, (user_id,))

            row = cursor.fetchone()

            if not row:
                return None

            return UserPreferenceDTO(
                user_id=row[0],
                style=row[1],
                tone=row[2],
                emoji_usage=row[3],
                avg_length=row[4],
                preferred_times=json.loads(row[5]) if row[5] else []
            )
        finally:
            conn.close()

    def record_feedback(
        self,
        user_id: int,
        post_id: int,
        original: str,
        edited: str
    ) -> bool:
        """
        Записывает фидбек - что пользователь исправил
        Учимся на правках!
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # Анализируем тип правки (логика в коде!)
            edit_type = self._analyze_edit_type(original, edited)

            cursor.execute("""
            INSERT INTO user_feedback
            (user_id, post_id, original_text, edited_text, edit_type)
            VALUES (?, ?, ?, ?, ?)
            """, (user_id, post_id, original, edited, edit_type))

            conn.commit()

            logger.info(f"Recorded feedback for user {user_id}: {edit_type}")
            return True

        except Exception as e:
            logger.error(f"Error recording feedback: {e}")
            return False
        finally:
            conn.close()

    def _analyze_edit_type(self, original: str, edited: str) -> str:
        """
        Определяет тип правки (в коде!)
        """
        if len(edited) < len(original) * 0.8:
            return 'shorten'
        elif len(edited) > len(original) * 1.2:
            return 'lengthen'
        elif original.count('\n') != edited.count('\n'):
            return 'restructure'
        else:
            return 'refine'


def get_user_memory(db_path: str = "data/user_memory.db") -> SQLiteMemory:
    """
    Фабрика для получения памяти пользователя
    """
    return SQLiteMemory(db_path)


# Глобальный инстанс (lazy initialization)
_user_memory: Optional[SQLiteMemory] = None


def get_memory() -> SQLiteMemory:
    """Получить глобальный инстанс памяти"""
    global _user_memory
    if _user_memory is None:
        _user_memory = SQLiteMemory()
    return _user_memory
