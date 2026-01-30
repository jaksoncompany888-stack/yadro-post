"""
Yadro Post - Unified Backend
Объединённая архитектура: API + Bot + AI
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Boolean, Integer, Text, DateTime, ForeignKey, select
from datetime import datetime, timedelta
from typing import Optional, List, Annotated
from pydantic import BaseModel, EmailStr
import jwt
from passlib.context import CryptContext
import os
from contextlib import asynccontextmanager

# ============= CONFIGURATION =============

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost/yadro_post")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# ============= DATABASE MODELS =============

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
class Channel(Base):
    __tablename__ = "channels"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    platform: Mapped[str] = mapped_column(String(50))  # telegram, vk, instagram
    channel_id: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Post(Base):
    __tablename__ = "posts"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    channel_id: Mapped[int] = mapped_column(Integer, ForeignKey("channels.id"))
    title: Mapped[str] = mapped_column(String(500))
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="draft")  # draft, scheduled, published
    scheduled_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Analytics(Base):
    """Реальная аналитика"""
    __tablename__ = "analytics"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(Integer, ForeignKey("posts.id"))
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)
    comments: Mapped[int] = mapped_column(Integer, default=0)
    collected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# ============= PYDANTIC SCHEMAS =============

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool
    is_admin: bool
    created_at: datetime
    
    model_config = {"from_attributes": True}

class ChannelCreate(BaseModel):
    platform: str
    channel_id: str
    name: str
    access_token: Optional[str] = None

class ChannelResponse(BaseModel):
    id: int
    platform: str
    channel_id: str
    name: str
    is_active: bool
    created_at: datetime
    
    model_config = {"from_attributes": True}

class PostCreate(BaseModel):
    channel_id: int
    title: str
    content: str
    scheduled_time: Optional[datetime] = None

class PostResponse(BaseModel):
    id: int
    channel_id: int
    title: str
    content: str
    status: str
    scheduled_time: Optional[datetime]
    published_at: Optional[datetime]
    created_at: datetime
    
    model_config = {"from_attributes": True}

# ============= DATABASE SETUP =============

engine = create_async_engine(DATABASE_URL, echo=True)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with async_session_maker() as session:
        yield session

async def init_db():
    """Инициализация БД"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# ============= AUTH UTILITIES =============

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except jwt.InvalidTokenError:
        raise credentials_exception
    
    result = await db.execute(select(User).filter(User.username == token_data.username))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# ============= FASTAPI APP =============

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    #await init_db() #заглушка БД не настроил рот ее
    print("Database initialized")
    yield
    # Shutdown
    await engine.dispose()
    print("Database connections closed")

app = FastAPI(
    title="Yadro Post - Unified API",
    description="СММ планировщик с AI и автопостингом",
    version="2.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============= AUTH ENDPOINTS =============

@app.post("/api/auth/register", response_model=UserResponse)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    """Регистрация нового пользователя"""
    
    # Проверка существования
    result = await db.execute(select(User).filter(User.email == user.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    result = await db.execute(select(User).filter(User.username == user.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Создание пользователя
    db_user = User(
        email=user.email,
        username=user.username,
        hashed_password=get_password_hash(user.password),
        full_name=user.full_name
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    
    return db_user

@app.post("/api/auth/login", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
):
    """Логин пользователя"""
    
    result = await db.execute(select(User).filter(User.username == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=UserResponse)
async def read_users_me(current_user: Annotated[User, Depends(get_current_active_user)]):
    """Получить текущего пользователя"""
    return current_user

# ============= CHANNELS ENDPOINTS =============

@app.post("/api/channels", response_model=ChannelResponse)
async def create_channel(
    channel: ChannelCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Добавить канал"""
    
    db_channel = Channel(
        user_id=current_user.id,
        platform=channel.platform,
        channel_id=channel.channel_id,
        name=channel.name,
        access_token=channel.access_token
    )
    db.add(db_channel)
    await db.commit()
    await db.refresh(db_channel)
    
    return db_channel

@app.get("/api/channels", response_model=List[ChannelResponse])
async def get_channels(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Получить все каналы пользователя"""
    
    result = await db.execute(
        select(Channel).filter(Channel.user_id == current_user.id)
    )
    channels = result.scalars().all()
    
    return channels

@app.delete("/api/channels/{channel_id}")
async def delete_channel(
    channel_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Удалить канал"""
    
    result = await db.execute(
        select(Channel).filter(
            Channel.id == channel_id,
            Channel.user_id == current_user.id
        )
    )
    channel = result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    await db.delete(channel)
    await db.commit()
    
    return {"message": "Channel deleted"}

# ============= POSTS ENDPOINTS =============

@app.post("/api/posts", response_model=PostResponse)
async def create_post(
    post: PostCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Создать пост (с опциональной генерацией вариантов)"""
    
    # Проверка что канал принадлежит пользователю
    result = await db.execute(
        select(Channel).filter(
            Channel.id == post.channel_id,
            Channel.user_id == current_user.id
        )
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Создание поста
    db_post = Post(
        user_id=current_user.id,
        channel_id=post.channel_id,
        title=post.title,
        content=post.content,
        scheduled_time=post.scheduled_time,
        status="scheduled" if post.scheduled_time else "draft"
    )
    db.add(db_post)
    await db.commit()
    await db.refresh(db_post)
    
    return db_post

@app.get("/api/posts", response_model=List[PostResponse])
async def get_posts(
    current_user: Annotated[User, Depends(get_current_active_user)],
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Получить посты пользователя"""
    
    query = select(Post).filter(Post.user_id == current_user.id)
    if status:
        query = query.filter(Post.status == status)
    
    result = await db.execute(query)
    posts = result.scalars().all()
    
    return posts

# ============= ANALYTICS ENDPOINTS =============

@app.post("/api/ai/generate")
async def generate_post_ai(
    request: dict,
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """Генерация поста через AI"""
    from ai_service import ai_service
    
    topic = request.get("topic", "")
    platform = request.get("platform", "telegram")
    style = request.get("style", "casual")
    
    if not topic:
        raise HTTPException(status_code=400, detail="Topic is required")
    
    result = await ai_service.generate_post(topic, platform, style)
    
    return {
        "content": result.content,
        "hashtags": result.hashtags,
        "suggested_time": result.suggested_time
    }

@app.post("/api/ai/edit")
async def edit_post_ai(
    request: dict,
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """Редактирование поста через AI"""
    from ai_service import ai_service
    
    text = request.get("text", "")
    instruction = request.get("instruction", "")
    
    if not text or not instruction:
        raise HTTPException(status_code=400, detail="Text and instruction are required")
    
    result = await ai_service.edit_post(text, instruction)
    
    return {"content": result}

# ============= ANALYTICS ENDPOINTS =============

@app.get("/api/analytics/posts/{post_id}")
async def get_post_analytics(
    post_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Получить аналитику поста"""
    
    # Проверка прав
    result = await db.execute(
        select(Post).filter(
            Post.id == post_id,
            Post.user_id == current_user.id
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Получение аналитики
    result = await db.execute(
        select(Analytics).filter(Analytics.post_id == post_id)
        .order_by(Analytics.collected_at.desc())
    )
    analytics = result.scalars().all()
    
    return {
        "post_id": post_id,
        "analytics": [
            {
                "views": a.views,
                "likes": a.likes,
                "shares": a.shares,
                "comments": a.comments,
                "collected_at": a.collected_at
            }
            for a in analytics
        ]
    }

# ============= HEALTH CHECK =============

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "yadro-post-unified",
        "version": "2.0.0"
    }

@app.get("/")
async def root():
    return {
        "name": "Ядро Post - Unified",
        "version": "2.0.0",
        "description": "Объединённая архитектура с auth и автопостингом"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
