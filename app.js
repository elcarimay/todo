'use strict';

const STORAGE_KEY = 'todos-v1';

let todos = [];
let filter = 'all';

// ── Persistence ───────────────────────────────────────────────────────────────

function loadTodos() {
    try {
        todos = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
    } catch {
        todos = [];
    }
}

function saveTodos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// ── Domain ────────────────────────────────────────────────────────────────────

function addTodo(text) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    todos.unshift({ id: crypto.randomUUID(), text: trimmed, completed: false });
    saveTodos();
    render();
    return true;
}

function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    todo.completed = !todo.completed;
    saveTodos();

    // Update DOM in-place to avoid interrupting any concurrent edit
    const item = document.querySelector(`.todo-item[data-id="${id}"]`);
    if (item) {
        const checkbox = item.querySelector('.checkbox');
        const textEl = item.querySelector('.todo-text');
        checkbox.classList.toggle('checked', todo.completed);
        checkbox.setAttribute('aria-checked', String(todo.completed));
        textEl.classList.toggle('completed', todo.completed);
    }

    // Filter views need a full re-render since items may disappear
    if (filter !== 'all') render();
    else renderFooter();
}

function deleteTodo(id) {
    const item = document.querySelector(`.todo-item[data-id="${id}"]`);
    if (!item) return;

    item.style.transition = 'opacity 0.15s, transform 0.15s';
    item.style.opacity = '0';
    item.style.transform = 'translateX(16px)';

    setTimeout(() => {
        todos = todos.filter(t => t.id !== id);
        saveTodos();
        render();
    }, 150);
}

function updateTodoText(id, text) {
    const trimmed = text.trim();
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    if (!trimmed) {
        // Restore original text without full re-render
        const el = document.querySelector(`.todo-text[data-id="${id}"]`);
        if (el) el.textContent = todo.text;
        return;
    }

    todo.text = trimmed;
    saveTodos();
}

function clearCompleted() {
    todos = todos.filter(t => !t.completed);
    saveTodos();
    render();
}

function visibleTodos() {
    if (filter === 'active')    return todos.filter(t => !t.completed);
    if (filter === 'completed') return todos.filter(t => t.completed);
    return todos;
}

// ── Render ────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
    const el = document.createElement('div');
    el.appendChild(document.createTextNode(str));
    return el.innerHTML;
}

function renderList() {
    const list = document.getElementById('todo-list');
    const items = visibleTodos();

    if (items.length === 0) {
        list.innerHTML = '<li class="empty-state">할 일이 없습니다</li>';
        return;
    }

    list.innerHTML = items.map(({ id, text, completed }) => `
        <li class="todo-item" data-id="${id}">
            <div class="checkbox ${completed ? 'checked' : ''}"
                 role="checkbox"
                 aria-checked="${completed}"
                 tabindex="0"
                 data-action="toggle"
                 data-id="${id}"></div>
            <span class="todo-text ${completed ? 'completed' : ''}"
                  contenteditable="true"
                  spellcheck="false"
                  data-id="${id}"
                  data-action="edit">${escapeHtml(text)}</span>
            <button class="delete-btn"
                    data-action="delete"
                    data-id="${id}"
                    aria-label="삭제">×</button>
        </li>
    `).join('');
}

function renderFooter() {
    const activeCount = todos.filter(t => !t.completed).length;
    const hasCompleted = todos.some(t => t.completed);
    const footer = document.getElementById('footer');

    footer.style.display = todos.length ? '' : 'none';
    document.getElementById('count').textContent = `${activeCount}개 남음`;
    document.getElementById('clear-btn').style.visibility = hasCompleted ? 'visible' : 'hidden';
}

function render() {
    renderList();
    renderFooter();
}

// ── Date ──────────────────────────────────────────────────────────────────────

function renderDate() {
    document.getElementById('date').textContent = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    });
}

// ── Events ────────────────────────────────────────────────────────────────────

function setupEvents() {
    const input = document.getElementById('new-todo');

    // Add todo
    function handleAdd() {
        if (addTodo(input.value)) {
            input.value = '';
            input.focus();
        }
    }

    document.getElementById('add-btn').addEventListener('click', handleAdd);

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleAdd();
    });

    // Filter tabs
    document.querySelector('.filters').addEventListener('click', e => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filter = btn.dataset.filter;
        render();
    });

    // Clear completed
    document.getElementById('clear-btn').addEventListener('click', clearCompleted);

    // Delegated list events
    const list = document.getElementById('todo-list');

    list.addEventListener('click', e => {
        const action = e.target.dataset.action;
        const id = e.target.dataset.id;
        if (!action || !id) return;
        if (action === 'toggle') toggleTodo(id);
        if (action === 'delete') deleteTodo(id);
    });

    // Keyboard: checkbox
    list.addEventListener('keydown', e => {
        if (e.target.dataset.action === 'toggle' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggleTodo(e.target.dataset.id);
        }
    });

    // Inline edit: commit on Enter, revert on Escape, save on blur
    list.addEventListener('keydown', e => {
        if (e.target.dataset.action !== 'edit') return;
        if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            const todo = todos.find(t => t.id === e.target.dataset.id);
            if (todo) e.target.textContent = todo.text;
            e.target.blur();
        }
    });

    list.addEventListener('focusout', e => {
        if (e.target.dataset.action === 'edit') {
            updateTodoText(e.target.dataset.id, e.target.textContent);
        }
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
    loadTodos();
    renderDate();
    render();
    setupEvents();
    document.getElementById('new-todo').focus();
}

init();
