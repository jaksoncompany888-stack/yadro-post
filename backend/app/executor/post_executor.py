"""
Yadro Post - Post Executor (Architecture-First)

Философия Architecture-First:
1. Логика В КОДЕ, не в промптах
2. AI - это инструмент, НЕ мозг
3. План создаёт КОД, AI только исполняет шаги
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import time
import logging

# Простой logger
logger = logging.getLogger("yadro.executor")


# ============= MODELS =============

class StepType(Enum):
    """Типы шагов (определены в коде!)"""
    ANALYZE_TOPIC = "analyze_topic"
    SEARCH_MEMORY = "search_memory"
    FIND_HOOK = "find_hook"
    STRUCTURE_POST = "structure_post"
    GENERATE_TEXT = "generate_text"
    FORMAT_POST = "format_post"
    VALIDATE = "validate"


@dataclass
class Step:
    """Один шаг выполнения"""
    type: StepType
    tool: str
    input_data: Dict[str, Any]
    output_key: str
    depends_on: List[str] = field(default_factory=list)


@dataclass
class PostPlan:
    """План выполнения задачи"""
    task_type: str
    steps: List[Step]
    metadata: Dict[str, Any]


@dataclass
class PostExecutionResult:
    """Результат выполнения"""
    success: bool
    output: Any
    steps_executed: int
    errors: List[str]
    duration_ms: float = 0.0


# ============= EXECUTOR =============

class PostExecutor:
    """
    Исполнитель задач генерации постов

    ВАЖНО: Создание плана - НЕ задача AI!
    План создаётся КОДОМ на основе типа задачи.
    """

    def __init__(self, user_memory=None, tool_registry=None):
        self.memory = user_memory
        self.tool_registry = tool_registry
        self.context: Dict[str, Any] = {}
        logger.info("PostExecutor initialized")

    def execute(self, task: Dict[str, Any]) -> PostExecutionResult:
        """
        Главный метод выполнения

        Поток:
        1. Создать план (КОД решает!)
        2. Выполнить шаги по порядку
        3. Собрать результат
        """
        start_time = time.time()
        steps_executed = 0
        errors = []

        # Очищаем контекст от предыдущих выполнений
        self.context = {}

        try:
            # Шаг 1: Создание плана (логика в коде!)
            logger.info(f"Creating plan for task: {task.get('type', 'unknown')}")
            plan = self._create_plan(task)

            # Шаг 2: Выполнение плана
            for step in plan.steps:
                logger.debug(f"Executing step: {step.type.value} with tool {step.tool}")
                try:
                    self._execute_step(step, task)
                    steps_executed += 1
                except Exception as e:
                    error_msg = f"Step {step.type.value} failed: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    # Продолжаем выполнение, если это не критичный шаг
                    if step.type in [StepType.GENERATE_TEXT, StepType.ANALYZE_TOPIC]:
                        raise  # Критичные шаги прерывают выполнение

            # Шаг 3: Сборка результата
            result = self._build_result()

            duration_ms = (time.time() - start_time) * 1000
            logger.info(f"Execution completed: {steps_executed} steps in {duration_ms:.0f}ms")

            return PostExecutionResult(
                success=True,
                output=result,
                steps_executed=steps_executed,
                errors=errors,
                duration_ms=duration_ms
            )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            error_msg = f"Execution failed: {type(e).__name__}: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)

            return PostExecutionResult(
                success=False,
                output=None,
                steps_executed=steps_executed,
                errors=errors,
                duration_ms=duration_ms
            )

    def _create_plan(self, task: Dict[str, Any]) -> PostPlan:
        """
        Создание плана выполнения

        КРИТИЧНО: Это НЕ AI задача!
        КОД определяет последовательность шагов!
        """
        task_type = task.get('type', 'generate_post')

        if task_type == 'generate_post':
            return self._plan_generate_post(task)
        elif task_type == 'analyze_competitor':
            return self._plan_analyze_competitor(task)
        elif task_type == 'simple_generate':
            return self._plan_simple_generate(task)
        else:
            # По умолчанию — простая генерация
            return self._plan_simple_generate(task)

    def _plan_generate_post(self, task: Dict[str, Any]) -> PostPlan:
        """
        План для генерации поста (полный)

        Последовательность (в коде!):
        1. Анализ темы (что за тема, категория, аудитория)
        2. Поиск в памяти (что у пользователя сработало)
        3. Выбор хука (паттерн зацепки)
        4. Структурирование (план поста)
        5. Генерация текста (AI здесь!)
        6. Форматирование (HTML теги, эмодзи)
        7. Валидация (длина, качество)
        """
        steps = [
            Step(
                type=StepType.ANALYZE_TOPIC,
                tool="TopicAnalyzer",
                input_data={'topic': task.get('topic', '')},
                output_key="topic_analysis"
            ),
        ]

        # Добавляем поиск в памяти только если память включена
        use_memory = task.get('use_memory', True) and self.memory is not None
        if use_memory and task.get('user_id'):
            steps.append(Step(
                type=StepType.SEARCH_MEMORY,
                tool="MemorySearch",
                input_data={
                    'user_id': task.get('user_id'),
                    'topic': task.get('topic', '')
                },
                output_key="similar_patterns",
                depends_on=["topic_analysis"]
            ))

        steps.extend([
            Step(
                type=StepType.FIND_HOOK,
                tool="HookFinder",
                input_data={
                    'topic_analysis': 'topic_analysis',  # Ссылка на контекст
                    'patterns': 'similar_patterns'
                },
                output_key="hook",
                depends_on=["topic_analysis"]
            ),
            Step(
                type=StepType.STRUCTURE_POST,
                tool="PostStructurer",
                input_data={
                    'topic_analysis': 'topic_analysis',
                    'hook': 'hook',
                    'user_preferences': task.get('preferences', {})
                },
                output_key="structure",
                depends_on=["hook"]
            ),
            Step(
                type=StepType.GENERATE_TEXT,
                tool="TextGenerator",
                input_data={
                    'structure': 'structure',
                    'hook': 'hook',
                    'topic_analysis': 'topic_analysis',
                    'style': task.get('style', 'casual')
                },
                output_key="raw_text",
                depends_on=["structure"]
            ),
            Step(
                type=StepType.FORMAT_POST,
                tool="PostFormatter",
                input_data={
                    'text': 'raw_text',
                    'platform': task.get('platform', 'telegram')
                },
                output_key="formatted_text",
                depends_on=["raw_text"]
            ),
            Step(
                type=StepType.VALIDATE,
                tool="PostValidator",
                input_data={
                    'text': 'formatted_text',
                    'platform': task.get('platform', 'telegram')
                },
                output_key="final_post",
                depends_on=["formatted_text"]
            )
        ])

        return PostPlan(
            task_type='generate_post',
            steps=steps,
            metadata={
                'user_id': task.get('user_id'),
                'topic': task.get('topic', ''),
                'platform': task.get('platform', 'telegram'),
                'style': task.get('style', 'casual')
            }
        )

    def _plan_simple_generate(self, task: Dict[str, Any]) -> PostPlan:
        """
        Упрощённый план (без памяти)
        """
        steps = [
            Step(
                type=StepType.ANALYZE_TOPIC,
                tool="TopicAnalyzer",
                input_data={'topic': task.get('topic', '')},
                output_key="topic_analysis"
            ),
            Step(
                type=StepType.FIND_HOOK,
                tool="HookFinder",
                input_data={
                    'topic_analysis': 'topic_analysis',
                    'patterns': []
                },
                output_key="hook",
                depends_on=["topic_analysis"]
            ),
            Step(
                type=StepType.GENERATE_TEXT,
                tool="TextGenerator",
                input_data={
                    'structure': {'body': [], 'conclusion': {}},
                    'hook': 'hook',
                    'topic_analysis': 'topic_analysis',
                    'style': task.get('style', 'casual')
                },
                output_key="raw_text",
                depends_on=["hook"]
            ),
            Step(
                type=StepType.FORMAT_POST,
                tool="PostFormatter",
                input_data={
                    'text': 'raw_text',
                    'platform': task.get('platform', 'telegram')
                },
                output_key="final_post",
                depends_on=["raw_text"]
            ),
        ]

        return PostPlan(
            task_type='simple_generate',
            steps=steps,
            metadata={'topic': task.get('topic', '')}
        )

    def _plan_analyze_competitor(self, task: Dict[str, Any]) -> PostPlan:
        """План для анализа конкурента (будущее)"""
        # TODO: Implement
        raise NotImplementedError("Competitor analysis not implemented yet")

    def _execute_step(self, step: Step, task: Dict[str, Any]):
        """
        Выполнение одного шага

        Логика:
        1. Получить данные из контекста (если есть зависимости)
        2. Вызвать нужный инструмент
        3. Сохранить результат в контекст
        """
        # Подготовка входных данных
        input_data = self._prepare_input(step, task)

        # Выполнение шага через соответствующий инструмент
        if self.tool_registry:
            tool = self.tool_registry.get(step.tool)
            if tool:
                result = tool.execute(input_data)
            else:
                # Мок для отсутствующих инструментов
                result = self._mock_tool_execution(step, input_data)
        else:
            # Без регистра инструментов — используем моки
            result = self._mock_tool_execution(step, input_data)

        # Сохранение результата
        self.context[step.output_key] = result

    def _mock_tool_execution(self, step: Step, input_data: Dict[str, Any]) -> Any:
        """Мок выполнения для отсутствующих инструментов"""
        logger.debug(f"Mock execution for {step.tool}")

        if step.type == StepType.ANALYZE_TOPIC:
            return {
                'topic': input_data.get('topic', ''),
                'category': 'general',
                'audience': 'general',
                'keywords': []
            }
        elif step.type == StepType.SEARCH_MEMORY:
            return []  # Нет паттернов
        elif step.type == StepType.FIND_HOOK:
            return {
                'text': '',
                'pattern': 'question'
            }
        elif step.type == StepType.STRUCTURE_POST:
            return {
                'intro': '',
                'body': [],
                'conclusion': ''
            }
        elif step.type == StepType.GENERATE_TEXT:
            return input_data.get('hook', {}).get('text', '')
        elif step.type == StepType.FORMAT_POST:
            return input_data.get('text', '')
        elif step.type == StepType.VALIDATE:
            return input_data.get('text', '')

        return None

    def _prepare_input(self, step: Step, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        Подготовка входных данных для шага
        Подставляет значения из контекста
        """
        input_data = {}

        for key, value in step.input_data.items():
            if isinstance(value, str) and value in self.context:
                # Это ссылка на данные из контекста
                input_data[key] = self.context[value]
            elif isinstance(value, str) and value.startswith('task.'):
                # Это ссылка на данные из задачи
                task_key = value.split('.', 1)[1]
                input_data[key] = task.get(task_key)
            else:
                input_data[key] = value

        return input_data

    def _build_result(self) -> Dict[str, Any]:
        """Сборка финального результата"""
        return {
            'content': self.context.get('final_post', self.context.get('raw_text', '')),
            'hook': self.context.get('hook', {}).get('text', ''),
            'structure': self.context.get('structure', {}),
            'metadata': {
                'topic_analysis': self.context.get('topic_analysis', {}),
                'patterns_used': self.context.get('similar_patterns', []),
                'hook_pattern': self.context.get('hook', {}).get('pattern', '')
            }
        }


# ============= FACTORY =============

def create_post_executor(with_memory: bool = True) -> PostExecutor:
    """
    Фабрика для создания PostExecutor

    Args:
        with_memory: Использовать ли систему памяти
    """
    memory = None
    if with_memory:
        try:
            from ..memory.user_memory import get_memory
            memory = get_memory()
        except ImportError:
            logger.warning("User memory not available")

    return PostExecutor(user_memory=memory)
